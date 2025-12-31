import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  adminPassword: string;
  questionId: string;
  correctNumber?: number | null;
  correctPlayerName?: string | null;
  correctPlayerTeam?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 500 });
  if (body.adminPassword !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!body.questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const { data: q, error: qErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, tournament_id, type")
    .eq("id", body.questionId)
    .single();

  if (qErr || !q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  if (q.type === "number") {
    if (body.correctNumber === undefined || body.correctNumber === null || Number.isNaN(Number(body.correctNumber))) {
      return NextResponse.json({ error: "correctNumber required" }, { status: 400 });
    }
    const { error } = await supabaseServer
      .from("bonus_questions")
      .update({ correct_number: Number(body.correctNumber), correct_player_id: null })
      .eq("id", q.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // type=player
  const name = (body.correctPlayerName || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "correctPlayerName required" }, { status: 400 });

  const { data: existing } = await supabaseServer
    .from("players")
    .select("id")
    .eq("tournament_id", q.tournament_id)
    .ilike("full_name", name)
    .limit(1);

  let playerId: string;

  if (existing && existing.length > 0) {
    playerId = existing[0].id;
  } else {
    const { data: created, error: cErr } = await supabaseServer
      .from("players")
      .insert({
        tournament_id: q.tournament_id,
        full_name: name,
        team: (body.correctPlayerTeam || "").trim() || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (cErr || !created) return NextResponse.json({ error: cErr?.message || "Failed to create player" }, { status: 500 });
    playerId = created.id;
  }

  const { error } = await supabaseServer
    .from("bonus_questions")
    .update({ correct_player_id: playerId, correct_number: null })
    .eq("id", q.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, correct_player_id: playerId });
}
