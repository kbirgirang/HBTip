// src/app/api/intermediate-round-standings/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET - Sækir milliriðilastöðu fyrir notendur
 * Notendur geta séð stöðuna fyrir active tournament
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId");
    const roundNumber = searchParams.get("roundNumber");

    let tournament;

    if (tournamentId) {
      // Ef tournamentId er gefið, nota það
      const { data: t, error: tErr } = await supabaseServer
        .from("tournaments")
        .select("id")
        .eq("id", tournamentId)
        .single();

      if (tErr || !t) {
        return NextResponse.json(
          { error: "Keppni fannst ekki" },
          { status: 404 }
        );
      }
      tournament = t;
    } else {
      // Ef ekki, nota active tournament
      const { data: t, error: tErr } = await supabaseServer
        .from("tournaments")
        .select("id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (tErr || !t) {
        return NextResponse.json({ standings: [] });
      }
      tournament = t;
    }

    // Ef roundNumber er ekki gefið, skila báðum milliriðlum
    if (!roundNumber) {
      const { data, error } = await supabaseServer
        .from("intermediate_round_standings")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("round_number", { ascending: true })
        .order("points", { ascending: false })
        .order("dp", { ascending: false })
        .order("team", { ascending: true });

      if (error) {
        console.error("GET intermediate-round-standings DB error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Group by round_number
      const grouped: Record<number, typeof data> = {};
      for (const row of data || []) {
        if (!grouped[row.round_number]) {
          grouped[row.round_number] = [];
        }
        grouped[row.round_number].push(row);
      }

      return NextResponse.json({
        standings: grouped,
      });
    }

    // Ef roundNumber er gefið, skila bara þeim milliriðli
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
      .eq("tournament_id", tournament.id)
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
