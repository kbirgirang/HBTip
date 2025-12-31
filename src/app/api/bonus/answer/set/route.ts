import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Body = {
  questionId: string;
  answerNumber?: number | null;
  answerPlayerName?: string | null; // ef type=player
  answerPlayerTeam?: string | null; // valfrjálst
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  // Sækja spurningu og athuga lokun
  const { data: q, error: qErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, tournament_id, type, closes_at")
    .eq("id", body.questionId)
    .single();

  if (qErr || !q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  if (new Date(q.closes_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Bonus question is closed" }, { status: 400 });
  }

  let answer_number: number | null = null;
  let answer_player_id: string | null = null;

  if (q.type === "number") {
    if (body.answerNumber === undefined || body.answerNumber === null || Number.isNaN(Number(body.answerNumber))) {
      return NextResponse.json({ error: "answerNumber required" }, { status: 400 });
    }
    answer_number = Number(body.answerNumber);
  } else if (q.type === "player") {
    const name = (body.answerPlayerName || "").trim();
    if (name.length < 2) return NextResponse.json({ error: "answerPlayerName required" }, { status: 400 });

    // Finna eða búa til player í players töflunni
    const { data: existing } = await supabaseServer
      .from("players")
      .select("id")
      .eq("tournament_id", q.tournament_id)
      .ilike("full_name", name)
      .limit(1);

    if (existing && existing.length > 0) {
      answer_player_id = existing[0].id;
    } else {
      const { data: created, error: cErr } = await supabaseServer
        .from("players")
        .insert({
          tournament_id: q.tournament_id,
          full_name: name,
          team: (body.answerPlayerTeam || "").trim() || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (cErr || !created) return NextResponse.json({ error: cErr?.message || "Failed to create player" }, { status: 500 });
      answer_player_id = created.id;
    }
  } else {
    return NextResponse.json({ error: "Unknown bonus question type" }, { status: 400 });
  }

  // Upsert svar (ein röð per member/question)
  const { error: upErr } = await supabaseServer
    .from("bonus_answers")
    .upsert(
      {
        room_id: session.roomId,
        member_id: session.memberId,
        question_id: q.id,
        answer_number,
        answer_player_id,
      },
      { onConflict: "member_id,question_id" }
    );

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, answer_number, answer_player_id });
}
