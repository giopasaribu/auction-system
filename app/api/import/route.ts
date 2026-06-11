import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { csvExportUrl } from "@/lib/sheets";

export async function POST() {
  const session = await getSession();
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheetsUrl = process.env.SHEETS_URL;
  if (!sheetsUrl) return NextResponse.json({ error: "SHEETS_URL not configured in .env" }, { status: 500 });

  const exportUrl = csvExportUrl(sheetsUrl);
  if (!exportUrl) return NextResponse.json({ error: "Invalid SHEETS_URL — could not extract sheet ID" }, { status: 500 });

  // Fetch CSV from Google Sheets (sheet must be publicly accessible)
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

  // Parse CSV — papaparse handles embedded newlines in header cells correctly
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: false });

  // Rows 1–4 in the spreadsheet are headers; skip them (0-indexed: indices 0–3)
  const dataRows = parsed.data.slice(4);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of dataRows) {
    const username = (row[0] ?? "").trim();
    const pointsRaw = (row[1] ?? "").trim();

    if (!username) { skipped++; continue; }

    const points = parseInt(pointsRaw, 10);
    if (isNaN(points)) {
      errors.push(`"${username}": invalid points value "${pointsRaw}"`);
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.player.findUnique({ where: { username } });
      if (existing) {
        await prisma.player.update({ where: { username }, data: { totalPoints: points } });
        updated++;
      } else {
        await prisma.player.create({ data: { username, totalPoints: points } });
        created++;
      }
    } catch (err) {
      errors.push(`"${username}": ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
