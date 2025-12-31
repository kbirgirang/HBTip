import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  adminPassword: string;
  matchId: string;
  title: string;
  type: "number" | "player";
  points?: number; // optional (DB default 5)
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminPassword = (body.adminPassword || "").trim();
  const matchId = (body.matchId || "").trim();
  const title = (body.title || "").trim();
  const type = body.type;
  const points = body.points;

  if (!adminPassword) return NextResponse.json({ error: "Admin password vantar." }, { status: 400 });
  if (!matchId) return NextResponse.json({ error: "matchId vantar." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title vantar." }, { status: 400 });
  if (type !== "number" && type !== "player") {
    return NextResponse.json({ error: "Type þarf að vera 'number' eða 'player'." }, { status: 400 });
  }
  if (points !== undefined && (!Number.isFinite(points) || points <= 0)) {
    return NextResponse.json({ error: "Points þarf að vera > 0." }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not set in .env.local" }, { status: 500 });
  }
  if (adminPassword !== expected) {
    return NextResponse.json({ error: "Wrong admin password" }, { status: 401 });
  }

  // 1) Active tournament
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Active tournament not found" }, { status: 500 });
  }

  // 2) Match must exist and belong to active tournament
  const { data: match, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, tournament_id, starts_at")
    .eq("id", matchId)
    .single();

  if (mErr || !match) {
    return NextResponse.json({ error: "Match not found (matchId rangt?)" }, { status: 404 });
  }

  if (match.tournament_id !== tournament.id) {
    return NextResponse.json({ error: "Match is not in active tournament" }, { status: 400 });
  }

  // closes_at follows match start (MVP)
  const closesAt = match.starts_at;

  // 3) Insert bonus question (1 per match enforced by unique index)
  const insertRow: Record<string, any> = {
    tournament_id: tournament.id,
    match_id: matchId,
    title,
    type,
    closes_at: closesAt,
    correct_number: null,
    correct_player_id: null,
  };

  if (points !== undefined) insertRow.points = points;

  const { data: bonus, error: bErr } = await supabaseServer
    .from("bonus_questions")
    .insert(insertRow)
    .select("id, match_id, title, type, points, closes_at")
    .single();

  if (bErr) {
    const msg = bErr.message || "Insert failed";

    // Supabase/Postgres error messages vary, check both common patterns
    const lower = msg.toLowerCase();
    if (lower.includes("uq_bonus_one_per_match") || lower.includes("duplicate key value")) {
      return NextResponse.json(
        { error: "Það er nú þegar bónusspurning á þessum leik. (1 bónus per match)" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bonus });
}
