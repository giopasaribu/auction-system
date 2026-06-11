import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { role, username, password } = await req.json();

  if (role === "admin") {
    const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme";
    const valid = password === adminPassword || await bcrypt.compare(password, adminPassword).catch(() => false);
    if (!valid) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

    const session = await getSession();
    session.role = "admin";
    session.username = "Admin";
    await session.save();
    return NextResponse.json({ ok: true, role: "admin" });
  }

  if (role === "player") {
    const player = await prisma.player.findUnique({ where: { username } });
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const session = await getSession();
    session.role = "player";
    session.userId = player.id;
    session.username = player.username;
    await session.save();
    return NextResponse.json({ ok: true, role: "player", userId: player.id });
  }

  return NextResponse.json({ error: "Invalid role" }, { status: 400 });
}
