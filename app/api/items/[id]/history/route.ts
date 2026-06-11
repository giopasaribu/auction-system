import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bids = await prisma.bid.findMany({
    where: { itemId: id },
    orderBy: { timestamp: "asc" },
    include: { player: { select: { username: true } } },
  });
  return NextResponse.json(bids);
}
