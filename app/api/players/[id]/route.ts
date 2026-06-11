import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { applyPointReduction } from "@/lib/auction";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { totalPoints } = await req.json();
  if (typeof totalPoints !== "number" || totalPoints < 0)
    return NextResponse.json({ error: "Invalid points value" }, { status: 400 });

  await applyPointReduction(id, totalPoints);
  const player = await prisma.player.findUnique({ where: { id } });
  return NextResponse.json(player);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Cancel any active leading bids before deleting
  await prisma.bid.updateMany({
    where: { playerId: id, isCurrentHighest: true, status: "active" },
    data: { status: "cancelled", isCurrentHighest: false },
  });
  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
