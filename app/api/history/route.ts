import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const detail = searchParams.get("detail") === "true";

  const isFiltered = from || to;

  const where = {
    status: AuctionStatus.ended,
    ...(isFiltered && {
      endTime: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      },
    }),
  };

  const rounds = await prisma.round.findMany({
    where,
    orderBy: { endTime: "desc" },
    take: isFiltered ? undefined : 1,
    include: {
      items: {
        orderBy: { name: "asc" },
        ...(!detail
          ? { where: { winnerId: { not: null } } }
          : {}),
        include: {
          winner: { select: { username: true } },
          ...(detail
            ? {
                bids: {
                  orderBy: { timestamp: "asc" },
                  include: { player: { select: { username: true } } },
                },
              }
            : {}),
        },
      },
    },
  });

  return NextResponse.json(
    rounds.map((round) => ({
      id: round.id,
      name: round.name,
      description: round.description,
      startTime: round.startTime,
      endTime: round.endTime,
      items: round.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        minBid: item.minBid,
        status: item.status,
        winnerUsername: item.winner?.username ?? null,
        winningBid: item.winningBid ?? null,
        ...(detail && "bids" in item
          ? {
              bids: (item.bids as unknown as { id: string; player: { username: string }; amount: number; timestamp: Date; status: string }[]).map((b) => ({
                id: b.id,
                username: b.player.username,
                amount: b.amount,
                timestamp: b.timestamp,
                status: b.status,
              })),
            }
          : {}),
      })),
    }))
  );
}
