import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";
import { fetchApiFootballFixtures, convertApiFootballResult } from "@/lib/apiFootball";

type Body = {
  tournamentSlug: string;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY er ekki sett í environment variables" }, { status: 500 });
  }

  // Sækja tournament
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id, slug, name, api_football_league_id, api_football_season, api_football_enabled")
    .eq("slug", body.tournamentSlug)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Keppni fannst ekki" }, { status: 404 });
  }

  if (!tournament.api_football_enabled || !tournament.api_football_league_id || !tournament.api_football_season) {
    return NextResponse.json(
      { error: "API-Football er ekki virkjað fyrir þessa keppni" },
      { status: 400 }
    );
  }

  try {
    // Sækja fixtures úr API-Football
    const fixtures = await fetchApiFootballFixtures(
      tournament.api_football_league_id,
      tournament.api_football_season,
      apiKey
    );

    // Sækja allar matches fyrir þetta tournament
    const { data: existingMatches, error: matchesErr } = await supabaseServer
      .from("matches")
      .select("id, home_team, away_team, starts_at, result")
      .eq("tournament_id", tournament.id);

    if (matchesErr) {
      return NextResponse.json({ error: matchesErr.message }, { status: 500 });
    }

    let updated = 0;
    let unchanged = 0;
    const errors: string[] = [];

    // Búa til map af existing matches (key: "homeTeam|awayTeam|date")
    const matchMap = new Map<string, typeof existingMatches[0]>();
    for (const match of existingMatches || []) {
      const dateKey = new Date(match.starts_at).toISOString().split("T")[0]; // YYYY-MM-DD
      const key = `${match.home_team}|${match.away_team}|${dateKey}`;
      matchMap.set(key, match);
    }

    for (const fixture of fixtures) {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const fixtureDate = new Date(fixture.fixture.date);
      const dateKey = fixtureDate.toISOString().split("T")[0];
      const result = convertApiFootballResult(fixture);

      // Finna match sem passar (með tolerance)
      const toleranceMs = 5 * 60 * 1000; // 5 mínútur
      let matchedMatch: typeof existingMatches[0] | null = null;

      for (const match of existingMatches || []) {
        if (
          match.home_team === homeTeam &&
          match.away_team === awayTeam &&
          Math.abs(new Date(match.starts_at).getTime() - fixtureDate.getTime()) < toleranceMs
        ) {
          matchedMatch = match;
          break;
        }
      }

      if (!matchedMatch) {
        unchanged++; // Leikur er ekki í kerfinu, skip
        continue;
      }

      // Uppfæra ef úrslit hafa breyst
      if (result !== null && matchedMatch.result !== result) {
        const { error: updateErr } = await supabaseServer
          .from("matches")
          .update({
            result,
            finished_at: result ? new Date().toISOString() : null,
          })
          .eq("id", matchedMatch.id);

        if (updateErr) {
          errors.push(`${homeTeam} vs ${awayTeam}: ${updateErr.message}`);
        } else {
          updated++;

          // Ef result var sett, loka bonus questions
          if (result) {
            await supabaseServer
              .from("bonus_questions")
              .update({ closes_at: new Date().toISOString() })
              .eq("match_id", matchedMatch.id);
          }
        }
      } else {
        unchanged++;
      }
    }

    return NextResponse.json({
      ok: true,
      updated,
      unchanged,
      total: fixtures.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error("API-Football update-results error:", error);
    return NextResponse.json(
      { error: error?.message || "Villa við að uppfæra úrslit úr API-Football" },
      { status: 500 }
    );
  }
}

