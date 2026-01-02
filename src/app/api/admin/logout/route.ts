import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/session";

export async function POST() {
  try {
    await clearAdminSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}

