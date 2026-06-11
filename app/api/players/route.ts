import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const players = await prisma.player.findMany({
    orderBy: { username: "asc" },
    include: {
      bids: {
        where: { isCurrentHighest: true, status: "active", item: { status: "active" } },
        select: { amount: true },
      },
    },
  });

  return NextResponse.json(
    players.map((p) => ({
      id: p.id,
      username: p.username,
      totalPoints: p.totalPoints,
      heldPoints: p.bids.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { username } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: "Username required" }, { status: 400 });

  try {
    const player = await prisma.player.create({ data: { username: username.trim() } });
    return NextResponse.json(player, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }
}
