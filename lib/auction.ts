import { prisma } from "./prisma";
import { AuctionStatus, BidStatus } from "./db";
import type { Prisma } from "./db";

type Tx = Prisma.TransactionClient;

export async function processExpiredAuctions() {
  const now = new Date();

  // Activate scheduled rounds whose startTime has arrived
  await prisma.round.updateMany({
    where: { status: AuctionStatus.scheduled, startTime: { lte: now } },
    data: { status: AuctionStatus.active },
  });

  // Activate scheduled standalone items or round items whose startTime has arrived
  await prisma.item.updateMany({
    where: { status: AuctionStatus.scheduled, startTime: { lte: now } },
    data: { status: AuctionStatus.active },
  });

  // Close expired active items — fetch only IDs here; re-read everything inside the transaction
  // to prevent concurrent calls from double-decrementing the winner's points.
  const expiredItemIds = await prisma.item.findMany({
    where: { status: AuctionStatus.active, endTime: { lte: now } },
    select: { id: true },
  });

  for (const { id: itemId } of expiredItemIds) {
    await prisma.$transaction(async (tx: Tx) => {
      // Lock the item row so concurrent processExpiredAuctions calls queue up,
      // then skip if another call already settled this item.
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Item" WHERE id = ${itemId} FOR UPDATE
      `;
      if (!rows[0] || rows[0].status !== AuctionStatus.active) return;

      // Re-read winner bid inside the lock to get a consistent snapshot.
      const winner = await tx.bid.findFirst({
        where: { itemId, isCurrentHighest: true, status: BidStatus.active },
      });

      if (winner) {
        await tx.player.update({
          where: { id: winner.playerId },
          data: { totalPoints: { decrement: winner.amount } },
        });
        await tx.bid.update({
          where: { id: winner.id },
          data: { status: BidStatus.won, isCurrentHighest: false },
        });
        await tx.item.update({
          where: { id: itemId },
          data: { status: AuctionStatus.ended, winnerId: winner.playerId, winningBid: winner.amount },
        });
      } else {
        await tx.item.update({
          where: { id: itemId },
          data: { status: AuctionStatus.ended },
        });
      }
    });
  }

  // Close rounds whose endTime has passed and all items are ended (or it has no items)
  const activeRounds = await prisma.round.findMany({
    where: { status: AuctionStatus.active, endTime: { lte: now } },
    include: { items: { select: { status: true } } },
  });

  for (const round of activeRounds) {
    const allSettled = round.items.every((i) => i.status === AuctionStatus.ended);
    if (allSettled) {
      await prisma.round.update({
        where: { id: round.id },
        data: { status: AuctionStatus.ended },
      });
    }
  }
}

export async function applyPointReduction(playerId: string, newTotal: number) {
  await prisma.$transaction(async (tx: Tx) => {
    const heldBids = await tx.bid.findMany({
      where: {
        playerId,
        isCurrentHighest: true,
        status: BidStatus.active,
        item: { status: AuctionStatus.active },
      },
      select: { id: true, amount: true, itemId: true },
    });

    const totalHeld = heldBids.reduce((sum, b) => sum + b.amount, 0);

    if (newTotal < totalHeld) {
      for (const bid of heldBids) {
        await tx.bid.update({
          where: { id: bid.id },
          data: { status: BidStatus.cancelled, isCurrentHighest: false },
        });
        await tx.item.update({
          where: { id: bid.itemId },
          data: { winnerId: null, winningBid: null },
        });
      }
    }

    await tx.player.update({
      where: { id: playerId },
      data: { totalPoints: newTotal },
    });
  });
}
