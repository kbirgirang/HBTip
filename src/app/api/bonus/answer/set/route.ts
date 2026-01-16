import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Body = {
  questionId: string;
  answerNumber?: number | null;
  answerChoice?: string | null; // ef type=choice
  answerPlayerName?: string | null; // ef type=player
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  const body = (await req.json()) as Body;
  if (!body.questionId) return NextResponse.json({ error: "questionId er krafist" }, { status: 400 });

  // 1) Fetch question with match_id
  const { data: q, error: qErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, tournament_id, type, closes_at, match_id")
    .eq("id", body.questionId)
    .single();

  if (qErr || !q) return NextResponse.json({ error: "Bónusspurning fannst ekki" }, { status: 404 });

  // 2) Fetch match to check starts_at and result
  const { data: match, error: mErr } = await supabaseServer
    .from("matches")
    .select("starts_at, result")
    .eq("id", q.match_id)
    .single();

  if (mErr || !match) return NextResponse.json({ error: "Leikur fannst ekki" }, { status: 404 });

  // 3) Lock check: match started OR bonus closed OR result is set
  const now = Date.now();
  const started = new Date(match.starts_at).getTime() <= now;
  const bonusClosed = new Date(q.closes_at).getTime() <= now;
  const locked = started || bonusClosed || match.result != null;

  if (locked) {
    return NextResponse.json({ error: "Bónus er lokað." }, { status: 400 });
  }

  let answer_number: number | null = null;
  let answer_choice: string | null = null;
  let answer_player_id: string | null = null;

  if (q.type === "number") {
    if (body.answerNumber === undefined || body.answerNumber === null || Number.isNaN(Number(body.answerNumber))) {
      return NextResponse.json({ error: "answerNumber er krafist" }, { status: 400 });
    }
    answer_number = Number(body.answerNumber);
  } else if (q.type === "choice") {
    if (!body.answerChoice || typeof body.answerChoice !== "string" || body.answerChoice.trim() === "") {
      return NextResponse.json({ error: "answerChoice er krafist" }, { status: 400 });
    }
    answer_choice = body.answerChoice.trim();
  } else if (q.type === "player") {
    if (!body.answerPlayerName || typeof body.answerPlayerName !== "string" || body.answerPlayerName.trim() === "") {
      return NextResponse.json({ error: "answerPlayerName er krafist" }, { status: 400 });
    }
    const answerPlayerName = body.answerPlayerName.trim();
    
    // Get player_options from question
    const { data: questionWithOptions, error: qOptErr } = await supabaseServer
      .from("bonus_questions")
      .select("player_options")
      .eq("id", body.questionId)
      .single();
    
    if (qOptErr || !questionWithOptions) {
      return NextResponse.json({ error: "Bónusspurning fannst ekki" }, { status: 404 });
    }
    
    const playerOptions = questionWithOptions.player_options as Array<{ name: string; team?: string }> | null;
    if (!playerOptions || !Array.isArray(playerOptions)) {
      return NextResponse.json({ error: "player_options fannst ekki í bónusspurningu" }, { status: 400 });
    }
    
    // Verify player name is in options
    const playerNames = playerOptions.map((p) => p.name.trim().toLowerCase());
    if (!playerNames.includes(answerPlayerName.toLowerCase())) {
      return NextResponse.json({ error: "Leikmaður er ekki í valmöguleikum" }, { status: 400 });
    }
    
    // Store player name as text (we'll use answer_choice field for player name since answer_player_id is for UUID)
    answer_choice = answerPlayerName;
    answer_player_id = null;
  } else {
    return NextResponse.json({ error: "Óþekktur gerð bónusspurningar" }, { status: 400 });
  }

  // ✅ Sækja allar deildir sem notandi er skráður í
  const { data: currentMember, error: memErr } = await supabaseServer
    .from("room_members")
    .select("username")
    .eq("id", session.memberId)
    .single();

  if (memErr || !currentMember) {
    return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });
  }

  // Sækja allar deildir sem notandi er í með sama username
  const { data: allMyMembers, error: allErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id")
    .ilike("username", currentMember.username);

  if (allErr) {
    return NextResponse.json({ error: allErr.message }, { status: 500 });
  }

  // ✅ Vista bónus svar fyrir ALLAR deildir sem notandi er í
  const answersToInsert = (allMyMembers ?? []).map((member: any) => ({
    room_id: member.room_id,
    member_id: member.id,
    question_id: q.id,
    answer_number,
    answer_choice,
    answer_player_id,
  }));

  if (answersToInsert.length === 0) {
    return NextResponse.json({ error: "Engar deildir fundust" }, { status: 400 });
  }

  // Upsert answers fyrir allar deildir
  // Nota ignoreDuplicates: false til að tryggja að svör séu alltaf uppfærð
  const { error: upErr } = await supabaseServer
    .from("bonus_answers")
    .upsert(answersToInsert, { 
      onConflict: "member_id,question_id",
      ignoreDuplicates: false 
    });

  if (upErr) {
    console.error("Error upserting bonus answers:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ 
    ok: true, 
    answer_number, 
    answer_choice, 
    roomsUpdated: answersToInsert.length,
    membersFound: allMyMembers?.length || 0
  });
}
