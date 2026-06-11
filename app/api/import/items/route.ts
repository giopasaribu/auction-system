import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { csvExportUrl } from "@/lib/sheets";
import { AuctionStatus } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { roundId } = await req.json();
  if (!roundId) return NextResponse.json({ error: "roundId required" }, { status: 400 });

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (round.status === AuctionStatus.ended)
    return NextResponse.json({ error: "Cannot add items to an ended round" }, { status: 400 });

  const sheetsUrl = process.env.SHEETS_ITEMS_URL;
  if (!sheetsUrl)
    return NextResponse.json({ error: "SHEETS_ITEMS_URL not configured in .env" }, { status: 500 });

  const exportUrl = csvExportUrl(sheetsUrl);
  if (!exportUrl)
    return NextResponse.json({ error: "Invalid SHEETS_ITEMS_URL — could not extract sheet ID or tab GID" }, { status: 500 });

  let csvText: string;
  try {
    const res = await fetch(exportUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch spreadsheet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: false });

  // Row 1 (index 0) is the title "LIST ITEM FOR BID" — skip it
  const dataRows = parsed.data.slice(1);

  const now = new Date();
  const itemStatus: AuctionStatus =
    now >= round.startTime ? AuctionStatus.active : AuctionStatus.scheduled;

  let created = 0;
  let skipped = 0;

  const itemsToCreate = dataRows
    .map((row) => (row[0] ?? "").trim())
    .filter((name) => name.length > 0);

  for (const name of itemsToCreate) {
    try {
      await prisma.item.create({
        data: {
          name,
          minBid: 0,
          startTime: round.startTime,
          endTime: round.endTime,
          timerMode: "hard",
          status: itemStatus,
          roundId: round.id,
          timeOverride: false,
        },
      });
      created++;
    } catch (err) {
      console.error(`Failed to create item "${name}":`, err);
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, roundName: round.name });
}
