import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AuctionStatus } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(round);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const now = new Date();

  const round = await prisma.round.findUnique({ where: { id } });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (round.status === AuctionStatus.ended)
    return NextResponse.json({ error: "Cannot edit an ended round" }, { status: 400 });

  let newStart = body.startTime ? new Date(body.startTime) : round.startTime;
  let newEnd = body.endTime ? new Date(body.endTime) : round.endTime;

  // Clamp: end time cannot be set earlier than now
  if (newEnd < now) newEnd = now;
  if (newStart > newEnd) newStart = round.startTime;

  if (newEnd <= newStart)
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const timesChanged =
    newStart.getTime() !== round.startTime.getTime() ||
    newEnd.getTime() !== round.endTime.getTime();

  const newStatus: AuctionStatus =
    now >= newStart ? AuctionStatus.active : AuctionStatus.scheduled;

  await prisma.$transaction(async (tx) => {
    await tx.round.update({
      where: { id },
      data: {
        name: body.name ?? round.name,
        description: body.description !== undefined ? body.description : round.description,
        startTime: newStart,
        endTime: newEnd,
        status: newStatus,
      },
    });

    // Propagate time change to all non-overridden items in this round
    if (timesChanged) {
      await tx.item.updateMany({
        where: { roundId: id, timeOverride: false, status: { not: AuctionStatus.ended } },
        data: {
          startTime: newStart,
          endTime: newEnd,
          status: newStatus,
        },
      });
    }
  });

  const updated = await prisma.round.findUnique({
    where: { id },
    include: { items: { select: { id: true, name: true, status: true, timeOverride: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Detach items from round (don't delete them — they become standalone)
  await prisma.item.updateMany({
    where: { roundId: id },
    data: { roundId: null, timeOverride: true },
  });

  await prisma.round.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
