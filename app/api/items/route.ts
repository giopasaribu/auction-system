import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { processExpiredAuctions } from "@/lib/auction";
import { AuctionStatus } from "@/lib/db";
import type { Item } from "@/lib/db";

type ItemWithRelations = Item & {
  winner: { username: string } | null;
  round: { id: string; name: string } | null;
  bids: { amount: number; playerId: string; player: { username: string } }[];
};

function serializeItem(item: ItemWithRelations) {
  const leading = item.bids[0] ?? null;
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    minBid: item.minBid,
    startTime: item.startTime,
    endTime: item.endTime,
    timerMode: item.timerMode,
    antiSnipeMinutes: item.antiSnipeMinutes,
    status: item.status,
    winnerId: item.winnerId,
    winningBid: item.winningBid,
    winnerUsername: item.winner?.username ?? null,
    roundId: item.roundId ?? null,
    roundName: item.round?.name ?? null,
    timeOverride: item.timeOverride,
    currentHighestBid: leading?.amount ?? null,
    currentHighestBidder: leading?.player?.username ?? null,
    currentHighestBidderId: leading?.playerId ?? null,
  };
}

export async function GET() {
  await processExpiredAuctions();

  const items = (await prisma.item.findMany({
    orderBy: { endTime: "asc" },
    include: {
      winner: { select: { username: true } },
      round: { select: { id: true, name: true } },
      bids: {
        where: { isCurrentHighest: true, status: "active" },
        include: { player: { select: { username: true } } },
      },
    },
  })) as ItemWithRelations[];

  return NextResponse.json(items.map(serializeItem));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, minBid, startTime, endTime, timerMode, antiSnipeMinutes, roundId } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const now = new Date();
  let start: Date;
  let end: Date;
  let timeOverride = false;

  if (roundId) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.status === "ended") return NextResponse.json({ error: "Round is already ended" }, { status: 400 });

    // Use provided times if given, otherwise inherit from round
    if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
      timeOverride = true;
    } else {
      start = round.startTime;
      end = round.endTime;
      timeOverride = false;
    }
  } else {
    if (!startTime || !endTime)
      return NextResponse.json({ error: "Start and end time required for standalone items" }, { status: 400 });
    start = new Date(startTime);
    end = new Date(endTime);
    timeOverride = true;
  }

  if (end <= start)
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });

  const status: AuctionStatus = now >= start ? AuctionStatus.active : AuctionStatus.scheduled;

  const item = await prisma.item.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      minBid: minBid ?? 0,
      startTime: start,
      endTime: end,
      timerMode: timerMode ?? "hard",
      antiSnipeMinutes: timerMode === "antisnipe" ? (antiSnipeMinutes ?? 2) : null,
      status,
      roundId: roundId ?? null,
      timeOverride,
    },
    include: {
      winner: { select: { username: true } },
      round: { select: { id: true, name: true } },
      bids: {
        where: { isCurrentHighest: true, status: "active" },
        include: { player: { select: { username: true } } },
      },
    },
  });

  return NextResponse.json(serializeItem(item as ItemWithRelations), { status: 201 });
}
