import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  // Get tournament slug from query parameter
  const { searchParams } = new URL(req.url);
  const tournamentSlug = searchParams.get("tournamentSlug");

  let t;
  if (tournamentSlug) {
    const { data, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("slug", tournamentSlug)
      .eq("is_active", true)
      .single();

    if (tErr || !data) {
      return NextResponse.json({ error: "Keppni fannst ekki eða er ekki virk" }, { status: 404 });
    }
    t = data;
  } else {
    // Default: fyrsta active tournament
    const { data, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tErr || !data) {
      return NextResponse.json({ error: "Engin virk keppni fannst" }, { status: 404 });
    }
    t = data;
  }

  // 2) Sækja leiki
  const { data: matches, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, stage, match_no, home_team, away_team, starts_at, allow_draw, result, underdog_team, underdog_multiplier, home_score, away_score")
    .eq("tournament_id", t.id)
    .order("match_no", { ascending: true, nullsFirst: false });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ matches: matches ?? [] });
}
