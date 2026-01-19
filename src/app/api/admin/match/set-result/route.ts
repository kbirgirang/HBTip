// src/app/api/admin/match/set-result/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  matchId?: string;
  result?: "1" | "X" | "2" | null; // null = clear result
  homeScore?: number | null;
  awayScore?: number | null;
};

function isValidResult(v: any): v is "1" | "X" | "2" | null {
  return v === null || v === "1" || v === "X" || v === "2";
}

export async function POST(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const body = (await req.json().catch(() => ({}))) as Body;

    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    if (!("result" in body)) {
      return NextResponse.json({ error: "result required (can be null)" }, { status: 400 });
    }

    if (!isValidResult(body.result)) {
      return NextResponse.json({ error: "Invalid result" }, { status: 400 });
    }

    // Validate scores: bæði verða að vera sett eða bæði null
    if ((body.homeScore != null && body.awayScore == null) || 
        (body.homeScore == null && body.awayScore != null)) {
      return NextResponse.json({ error: "Bæði homeScore og awayScore verða að vera sett eða bæði null" }, { status: 400 });
    }

    // Validate score values
    if (body.homeScore != null && (body.homeScore < 0 || !Number.isInteger(body.homeScore))) {
      return NextResponse.json({ error: "homeScore verður að vera jákvæð heiltala" }, { status: 400 });
    }
    if (body.awayScore != null && (body.awayScore < 0 || !Number.isInteger(body.awayScore))) {
      return NextResponse.json({ error: "awayScore verður að vera jákvæð heiltala" }, { status: 400 });
    }

    // finished_at: set when result is set, cleared when result is cleared
    const nowIso = new Date().toISOString();
    const finishedAt = body.result ? nowIso : null;

    // 1) Update match result and scores
    const { error } = await supabaseServer
      .from("matches")
      .update({
        result: body.result,
        finished_at: finishedAt,
        home_score: body.homeScore ?? null,
        away_score: body.awayScore ?? null,
      })
      .eq("id", body.matchId);

    if (error) {
      console.error("set-result DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2) If result was set -> close bonus immediately
    if (body.result) {
      const { error: bErr } = await supabaseServer
        .from("bonus_questions")
        .update({ closes_at: nowIso })
        .eq("match_id", body.matchId);

      if (bErr) {
        console.error("set-result bonus close error:", bErr);
        return NextResponse.json({ error: bErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("set-result unexpected error:", e);
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}
