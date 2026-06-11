import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.role) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { role: session.role, username: session.username, userId: session.userId },
  });
}
