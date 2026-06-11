import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { processExpiredAuctions } from "@/lib/auction";
import { AuctionStatus, BidStatus, TimerMode } from "@/lib/db";
import type { Prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id: itemId } = await params;
  const { amount: rawAmount, plusOne } = await req.json();

  await processExpiredAuctions();

  const now = new Date();

  const result = await prisma.$transaction(async (tx: Tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) return { error: "Item not found", status: 404 };

    if (item.status !== AuctionStatus.active || now < item.startTime || now >= item.endTime) {
      return { error: "Bidding is not open for this item", status: 400 };
    }

    const currentLeadingBid = await tx.bid.findFirst({
      where: { itemId, isCurrentHighest: true, status: BidStatus.active },
    });

    const currentHighest = currentLeadingBid?.amount ?? 0;
    const minBid = item.minBid ?? 0;

    let amount: number;
    if (plusOne) {
      amount = currentHighest === 0 ? Math.max(1, minBid) : currentHighest + 1;
    } else {
      amount = Number(rawAmount);
    }

    if (!Number.isInteger(amount) || amount <= 0)
      return { error: "Invalid bid amount", status: 400 };
    if (amount <= currentHighest)
      return { error: `Bid must be greater than current highest (${currentHighest})`, status: 400 };
    if (minBid > 0 && amount < minBid)
      return { error: `Bid must be at least the minimum bid (${minBid})`, status: 400 };

    const player = await tx.player.findUnique({ where: { id: session.userId! } });
    if (!player) return { error: "Player not found", status: 404 };

    const heldBids = await tx.bid.findMany({
      where: {
        playerId: session.userId!,
        isCurrentHighest: true,
        status: BidStatus.active,
        item: { status: AuctionStatus.active },
      },
      select: { amount: true, itemId: true },
    });

    const heldOnThisItem = heldBids.find((b) => b.itemId === itemId)?.amount ?? 0;
    const heldOnOthers = heldBids
      .filter((b) => b.itemId !== itemId)
      .reduce((s, b) => s + b.amount, 0);
    const availablePoints = player.totalPoints - heldOnOthers;

    if (amount > availablePoints) {
      return {
        error: `Insufficient points. Available: ${availablePoints}, Bid: ${amount}`,
        status: 400,
      };
    }

    // Release previous leader (including self-raise)
    if (currentLeadingBid) {
      await tx.bid.update({
        where: { id: currentLeadingBid.id },
        data: { isCurrentHighest: false, status: BidStatus.outbid },
      });
    }

    // Anti-snipe extension
    if (item.timerMode === TimerMode.antisnipe && item.antiSnipeMinutes) {
      const windowMs = item.antiSnipeMinutes * 60 * 1000;
      const windowStart = new Date(item.endTime.getTime() - windowMs);
      if (now >= windowStart) {
        const newEndTime = new Date(now.getTime() + windowMs);
        await tx.item.update({ where: { id: itemId }, data: { endTime: newEndTime } });
      }
    }

    const bid = await tx.bid.create({
      data: {
        itemId,
        playerId: session.userId!,
        amount,
        isCurrentHighest: true,
        status: BidStatus.active,
      },
    });

    // Suppress unused variable warning
    void heldOnThisItem;

    return { bid };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.bid, { status: 201 });
}
