import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  tournamentId: string;
  apiFootballLeagueId?: number | null;
  apiFootballSeason?: number | null;
  apiFootballEnabled?: boolean;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;

  if (!body.tournamentId) {
    return NextResponse.json({ error: "tournamentId er krafist" }, { status: 400 });
  }

  // Validate league ID and season if enabled
  if (body.apiFootballEnabled) {
    if (!body.apiFootballLeagueId || body.apiFootballLeagueId <= 0) {
      return NextResponse.json({ error: "League ID er krafist ef API-Football er virkjað" }, { status: 400 });
    }
    if (!body.apiFootballSeason || body.apiFootballSeason < 2000 || body.apiFootballSeason > 2100) {
      return NextResponse.json({ error: "Season þarf að vera á milli 2000 og 2100" }, { status: 400 });
    }
  }

  const updateData: any = {};
  if (body.apiFootballEnabled !== undefined) {
    updateData.api_football_enabled = body.apiFootballEnabled;
  }
  if (body.apiFootballLeagueId !== undefined) {
    updateData.api_football_league_id = body.apiFootballLeagueId || null;
  }
  if (body.apiFootballSeason !== undefined) {
    updateData.api_football_season = body.apiFootballSeason || null;
  }

  const { data, error } = await supabaseServer
    .from("tournaments")
    .update(updateData)
    .eq("id", body.tournamentId)
    .select("id, slug, name, api_football_league_id, api_football_season, api_football_enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tournament: data });
}

