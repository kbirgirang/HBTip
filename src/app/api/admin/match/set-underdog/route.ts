// src/app/api/admin/match/set-underdog/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  matchId: string;
  underdogTeam: "1" | "2" | null; // null = clear underdog
  underdogMultiplier: number | null; // null = clear underdog
};

export async function POST(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const body = (await req.json()) as Body;

    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    // Validate: ef annaðhvort er sett, verður bæði að vera sett
    if ((body.underdogTeam != null && body.underdogMultiplier == null) || 
        (body.underdogTeam == null && body.underdogMultiplier != null)) {
      return NextResponse.json({ error: "Bæði underdogTeam og underdogMultiplier verða að vera sett eða bæði null" }, { status: 400 });
    }

    // Validate multiplier
    if (body.underdogMultiplier != null && (body.underdogMultiplier < 1.0 || body.underdogMultiplier > 10.0)) {
      return NextResponse.json({ error: "underdogMultiplier verður að vera á milli 1.0 og 10.0" }, { status: 400 });
    }

    // Update match
    const { error } = await supabaseServer
      .from("matches")
      .update({
        underdog_team: body.underdogTeam,
        underdog_multiplier: body.underdogMultiplier,
      })
      .eq("id", body.matchId);

    if (error) {
      console.error("set-underdog DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("set-underdog unexpected error:", e);
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}

