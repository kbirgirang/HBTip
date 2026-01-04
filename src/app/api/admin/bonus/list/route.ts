// src/app/api/admin/bonus/list/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
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

      if (tErr || !data) return NextResponse.json({ error: "Keppni fannst ekki eða er ekki virk" }, { status: 404 });
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

      if (tErr || !data) return NextResponse.json({ error: "Engin virk keppni fannst" }, { status: 404 });
      t = data;
    }

    // 1) Matches
    const { data: matches, error: mErr } = await supabaseServer
      .from("matches")
      .select("id, match_no, stage, home_team, away_team, starts_at, allow_draw, result")
      .eq("tournament_id", t.id)
      .order("starts_at", { ascending: true });

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    // 2) Bonus questions (include correct fields too)
    const { data: bonus, error: bErr } = await supabaseServer
      .from("bonus_questions")
      .select(
        "id, match_id, title, type, points, closes_at, choice_options, correct_number, correct_choice, correct_player_id, player_options"
      )
      .eq("tournament_id", t.id);

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

    // Fetch player names for correct_player_id
    const playerIds = new Set<string>();
    for (const q of bonus ?? []) {
      if (q.correct_player_id) playerIds.add(q.correct_player_id);
    }
    let playersMap = new Map<string, { id: string; full_name: string }>();
    if (playerIds.size > 0) {
      const { data: players, error: pErr } = await supabaseServer
        .from("players")
        .select("id, full_name")
        .in("id", Array.from(playerIds));
      if (!pErr && players) {
        for (const p of players) {
          playersMap.set(p.id, p);
        }
      }
    }

    const bonusByMatchId = new Map<string, any>();
    for (const q of bonus ?? []) {
      const correctPlayer = q.correct_player_id ? playersMap.get(q.correct_player_id) : null;
      // For player type, correct_choice contains the correct player name
      let correctPlayerName = correctPlayer?.full_name ?? null;
      if (q.type === "player" && q.correct_choice) {
        correctPlayerName = q.correct_choice;
      }
      bonusByMatchId.set(q.match_id, {
        ...q,
        correct_player_name: correctPlayerName,
      });
    }

    const out = (matches ?? []).map((m) => ({
      ...m,
      bonus: bonusByMatchId.get(m.id) ?? null,
    }));

    return NextResponse.json({ matches: out });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}
