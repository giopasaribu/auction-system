import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processExpiredAuctions } from "@/lib/auction";

export async function GET() {
  await processExpiredAuctions();

  const [players, rounds, standaloneItems] = await Promise.all([
    prisma.player.findMany({
      orderBy: { totalPoints: "desc" },
      include: {
        bids: {
          where: { isCurrentHighest: true, status: "active", item: { status: "active" } },
          select: { amount: true },
        },
      },
    }),
    prisma.round.findMany({
      orderBy: [{ status: "asc" }, { endTime: "asc" }],
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            winner: { select: { username: true } },
            bids: {
              orderBy: { timestamp: "asc" },
              include: { player: { select: { username: true } } },
            },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { roundId: null },
      orderBy: [{ status: "asc" }, { endTime: "asc" }],
      include: {
        winner: { select: { username: true } },
        bids: {
          orderBy: { timestamp: "asc" },
          include: { player: { select: { username: true } } },
        },
      },
    }),
  ]);

  function serializeItem(item: typeof standaloneItems[number]) {
    const leadingBid = item.bids.find(
      (b: { isCurrentHighest: boolean; status: string }) => b.isCurrentHighest && b.status === "active"
    );
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
      winnerUsername: (item as typeof item & { winner: { username: string } | null }).winner?.username ?? null,
      timeOverride: item.timeOverride,
      currentHighestBid: (leadingBid as { amount: number } | undefined)?.amount ?? null,
      currentHighestBidder: (leadingBid as { player: { username: string } } | undefined)?.player?.username ?? null,
      currentHighestBidderId: (leadingBid as { playerId: string } | undefined)?.playerId ?? null,
      history: item.bids.map((b: { id: string; player: { username: string }; amount: number; timestamp: Date; status: string }) => ({
        id: b.id,
        username: b.player.username,
        amount: b.amount,
        timestamp: b.timestamp,
        status: b.status,
      })),
    };
  }

  return NextResponse.json({
    players: players.map((p) => ({
      id: p.id,
      username: p.username,
      totalPoints: p.totalPoints,
      heldPoints: p.bids.reduce((s: number, b: { amount: number }) => s + b.amount, 0),
    })),
    rounds: rounds.map((round) => ({
      id: round.id,
      name: round.name,
      description: round.description,
      startTime: round.startTime,
      endTime: round.endTime,
      status: round.status,
      items: round.items.map(serializeItem),
    })),
    standaloneItems: standaloneItems.map(serializeItem),
  });
}
