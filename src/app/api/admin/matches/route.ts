import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  // 1) Finna active tournament (eða þú getur hardcodað slug)
  const { data: t, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !t) {
    return NextResponse.json({ error: "Active tournament not found" }, { status: 404 });
  }

  // 2) Sækja leiki
  const { data: matches, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, stage, match_no, home_team, away_team, starts_at, allow_draw, result, underdog_team, underdog_multiplier")
    .eq("tournament_id", t.id)
    .order("match_no", { ascending: true, nullsFirst: false });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ matches: matches ?? [] });
}
