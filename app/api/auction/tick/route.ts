import { NextResponse } from "next/server";
import { processExpiredAuctions } from "@/lib/auction";

// Called by Vercel Cron or a client-side interval to advance auction states
export async function GET() {
  await processExpiredAuctions();
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
