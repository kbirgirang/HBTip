import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const adminPassword = String(body?.adminPassword || "");
    const matchId = String(body?.matchId || "");

    if (!adminPassword) {
      return NextResponse.json({ error: "Admin password vantar." }, { status: 400 });
    }
    if (!matchId) {
      return NextResponse.json({ error: "matchId vantar." }, { status: 400 });
    }

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json({ error: "ADMIN_PASSWORD er ekki sett í .env.local" }, { status: 500 });
    }
    if (adminPassword !== expected) {
      return NextResponse.json({ error: "Rangt admin password." }, { status: 401 });
    }

    // Delete match (should cascade delete predictions + bonus_questions if FK on delete cascade)
    const { error: dErr } = await supabaseServer.from("matches").delete().eq("id", matchId);

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}
