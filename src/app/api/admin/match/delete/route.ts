import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function POST(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const matchId = String(body?.matchId || "");

    if (!matchId) {
      return NextResponse.json({ error: "matchId vantar." }, { status: 400 });
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
