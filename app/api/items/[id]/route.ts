import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      winner: { select: { username: true } },
      round: { select: { id: true, name: true } },
      bids: {
        orderBy: { timestamp: "desc" },
        include: { player: { select: { username: true } } },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const timesChanged = body.startTime !== undefined || body.endTime !== undefined;

  const item = await prisma.item.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      minBid: body.minBid ?? undefined,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      timerMode: body.timerMode ?? undefined,
      antiSnipeMinutes: body.antiSnipeMinutes ?? undefined,
      // Editing times on a round-member marks it as individually overridden
      timeOverride: timesChanged ? true : undefined,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.bid.deleteMany({ where: { itemId: id } });
  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
