// src/app/api/admin/intermediate-round-standings/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type StandingRow = {
  id?: string;
  team: string;
  gp: number;
  win: number;
  draw: number;
  lose: number;
  dp: number;
  points: number;
};

type Body = {
  tournamentId?: string;
  roundNumber?: number;
  standings?: StandingRow[];
};

/**
 * GET - Sækir milliriðilastöðu fyrir tiltekinn keppni og milliriðil
 */
export async function GET(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId");
    const roundNumber = searchParams.get("roundNumber");

    if (!tournamentId || !roundNumber) {
      return NextResponse.json(
        { error: "tournamentId og roundNumber krafist" },
        { status: 400 }
      );
    }

    const roundNum = parseInt(roundNumber, 10);
    if (roundNum !== 1 && roundNum !== 2) {
      return NextResponse.json(
        { error: "roundNumber verður að vera 1 eða 2" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("intermediate_round_standings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("round_number", roundNum)
      .order("points", { ascending: false })
      .order("dp", { ascending: false })
      .order("team", { ascending: true });

    if (error) {
      console.error("GET intermediate-round-standings DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ standings: data || [] });
  } catch (e) {
    console.error("GET intermediate-round-standings unexpected error:", e);
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}

/**
 * POST - Setur/uppfærir milliriðilastöðu
 */
export async function POST(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const body = (await req.json().catch(() => ({}))) as Body;

    if (!body.tournamentId || typeof body.tournamentId !== "string") {
      return NextResponse.json(
        { error: "tournamentId krafist" },
        { status: 400 }
      );
    }

    if (!body.roundNumber || (body.roundNumber !== 1 && body.roundNumber !== 2)) {
      return NextResponse.json(
        { error: "roundNumber verður að vera 1 eða 2" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.standings)) {
      return NextResponse.json(
        { error: "standings verður að vera array" },
        { status: 400 }
      );
    }

    // Validate each standing row
    for (const standing of body.standings) {
      if (!standing.team || typeof standing.team !== "string") {
        return NextResponse.json(
          { error: "Hvert lið verður að hafa team (texti)" },
          { status: 400 }
        );
      }
      if (
        typeof standing.gp !== "number" ||
        typeof standing.win !== "number" ||
        typeof standing.draw !== "number" ||
        typeof standing.lose !== "number" ||
        typeof standing.dp !== "number" ||
        typeof standing.points !== "number"
      ) {
        return NextResponse.json(
          { error: "Öll tölugildi (gp, win, draw, lose, dp, points) verða að vera tölur" },
          { status: 400 }
        );
      }
      if (
        standing.gp < 0 ||
        standing.win < 0 ||
        standing.draw < 0 ||
        standing.lose < 0 ||
        standing.points < 0
      ) {
        return NextResponse.json(
          { error: "gp, win, draw, lose og points verða að vera jákvæðar tölur eða 0" },
          { status: 400 }
        );
      }
    }

    // Delete existing standings for this tournament and round
    const { error: deleteError } = await supabaseServer
      .from("intermediate_round_standings")
      .delete()
      .eq("tournament_id", body.tournamentId)
      .eq("round_number", body.roundNumber);

    if (deleteError) {
      console.error("POST intermediate-round-standings delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new standings
    if (body.standings.length > 0) {
      const rowsToInsert = body.standings.map((s) => ({
        tournament_id: body.tournamentId,
        round_number: body.roundNumber,
        team: s.team,
        gp: s.gp,
        win: s.win,
        draw: s.draw,
        lose: s.lose,
        dp: s.dp,
        points: s.points,
      }));

      const { error: insertError } = await supabaseServer
        .from("intermediate_round_standings")
        .insert(rowsToInsert);

      if (insertError) {
        console.error("POST intermediate-round-standings insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST intermediate-round-standings unexpected error:", e);
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}
