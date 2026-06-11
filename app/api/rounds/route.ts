import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AuctionStatus } from "@/lib/db";

export async function GET() {
  const rounds = await prisma.round.findMany({
    orderBy: { startTime: "desc" },
    include: {
      items: {
        select: { id: true, name: true, status: true, timeOverride: true },
      },
    },
  });
  return NextResponse.json(rounds);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, startTime, endTime } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!startTime || !endTime) return NextResponse.json({ error: "Start and end time required" }, { status: 400 });

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const now = new Date();
  const status: AuctionStatus = now >= start ? AuctionStatus.active : AuctionStatus.scheduled;

  const round = await prisma.round.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      startTime: start,
      endTime: end,
      status,
    },
  });

  return NextResponse.json(round, { status: 201 });
}
