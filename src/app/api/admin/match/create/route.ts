import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  stage?: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string; // ISO string
  allowDraw: boolean;
  matchNo?: number;
  tournamentSlug?: string;
};

export async function POST(req: Request) {
  // Check admin session
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;

  const homeTeam = (body.homeTeam || "").trim();
  const awayTeam = (body.awayTeam || "").trim();
  const stage = (body.stage || "").trim() || null;

  if (homeTeam.length < 2 || awayTeam.length < 2) {
    return NextResponse.json({ error: "homeTeam/awayTeam required" }, { status: 400 });
  }
  if (!body.startsAt) {
    return NextResponse.json({ error: "startsAt required" }, { status: 400 });
  }

  const startsAt = new Date(body.startsAt);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt must be valid date" }, { status: 400 });
  }

  // Tournament id (from slug or default to first active)
  const tournamentSlug = body.tournamentSlug || null;
  
  let tournament;
  if (tournamentSlug) {
    const { data: t, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("slug", tournamentSlug)
      .eq("is_active", true)
      .single();
    
    if (tErr || !t) {
      return NextResponse.json({ error: "Keppni fannst ekki eða er ekki virk" }, { status: 400 });
    }
    tournament = t;
  } else {
    // Default: fyrsta active tournament
    const { data: t, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (tErr || !t) {
      return NextResponse.json({ error: "Engin virk keppni fannst" }, { status: 404 });
    }
    tournament = t;
  }

  const { data: match, error: mErr } = await supabaseServer
    .from("matches")
    .insert({
      tournament_id: tournament.id,
      match_no: body.matchNo ?? null,
      stage,
      home_team: homeTeam,
      away_team: awayTeam,
      starts_at: startsAt.toISOString(),
      allow_draw: !!body.allowDraw,
      result: null,
      finished_at: null,
    })
    .select("id")
    .single();

  if (mErr || !match) {
    return NextResponse.json({ error: mErr?.message || "Failed to create match" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, matchId: match.id });
}
