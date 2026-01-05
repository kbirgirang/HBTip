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
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();

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
      { error: "API-Football er ekki virkjað fyrir þessa keppni. Setja þarf league ID og season." },
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

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const fixture of fixtures) {
      const homeTeam = fixture.teams.home.name;
      const awayTeam = fixture.teams.away.name;
      const startsAt = new Date(fixture.fixture.date);
      const result = convertApiFootballResult(fixture);
      const stage = fixture.league.round || null;

      // Athuga hvort leikur sé þegar til (með home_team, away_team, starts_at sem er nálægt)
      // Notum 5 mínútna tolerance fyrir tíma
      const toleranceMs = 5 * 60 * 1000;
      const startTimeMin = new Date(startsAt.getTime() - toleranceMs).toISOString();
      const startTimeMax = new Date(startsAt.getTime() + toleranceMs).toISOString();

      const { data: existing, error: findErr } = await supabaseServer
        .from("matches")
        .select("id, result, home_team, away_team, stage")
        .eq("tournament_id", tournament.id)
        .eq("home_team", homeTeam)
        .eq("away_team", awayTeam)
        .gte("starts_at", startTimeMin)
        .lte("starts_at", startTimeMax)
        .maybeSingle();

      if (findErr && findErr.code !== "PGRST116") {
        // PGRST116 = no rows found, sem er ok
        errors.push(`${homeTeam} vs ${awayTeam}: ${findErr.message}`);
        continue;
      }

      if (existing) {
        // Uppfæra ef úrslit hafa breyst eða ef það var ekki sett áður
        if (result !== null && existing.result !== result) {
          const { error: updateErr } = await supabaseServer
            .from("matches")
            .update({
              result,
              finished_at: result ? new Date().toISOString() : null,
              stage: stage || undefined,
            })
            .eq("id", existing.id);

          if (updateErr) {
            errors.push(`${homeTeam} vs ${awayTeam}: ${updateErr.message}`);
          } else {
            updated++;
          }
        } else {
          // Uppfæra stage ef það hefur breyst
          if (stage && stage !== existing.stage) {
            await supabaseServer
              .from("matches")
              .update({ stage })
              .eq("id", existing.id);
          }
          skipped++;
        }
      } else {
        // Búa til nýjan leik
        const { error: insertErr } = await supabaseServer
          .from("matches")
          .insert({
            tournament_id: tournament.id,
            home_team: homeTeam,
            away_team: awayTeam,
            starts_at: startsAt.toISOString(),
            allow_draw: true,
            result,
            finished_at: result ? new Date().toISOString() : null,
            stage,
          });

        if (insertErr) {
          errors.push(`${homeTeam} vs ${awayTeam}: ${insertErr.message}`);
        } else {
          created++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      total: fixtures.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Takmarka við 10 villur
    });
  } catch (error: any) {
    console.error("API-Football sync error:", error);
    return NextResponse.json(
      { error: error?.message || "Villa við að sækja gögn úr API-Football" },
      { status: 500 }
    );
  }
}

