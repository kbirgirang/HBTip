import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}

