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

  // Tournament id (seeded in DB)
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("slug", "mens-ehf-euro-2026")
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 500 });
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
