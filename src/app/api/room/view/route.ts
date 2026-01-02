import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Pick = "1" | "X" | "2";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  // 1) Room + tournament
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name, tournament_id")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // 2) Current member
  const { data: me, error: meErr } = await supabaseServer
    .from("room_members")
    .select("id, display_name, is_owner, username")
    .eq("id", session.memberId)
    .single();

  if (meErr || !me) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  // 3) Matches
  const { data: matches, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, match_no, stage, home_team, away_team, starts_at, allow_draw, result")
    .eq("tournament_id", room.tournament_id)
    .order("match_no", { ascending: true, nullsFirst: false });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // 4) Bonus questions PER MATCH (1 per match) + choice fields + player fields
  const { data: bonusQs, error: bErr } = await supabaseServer
    .from("bonus_questions")
    .select(
      "id, match_id, title, type, points, closes_at, correct_number, choice_options, correct_choice, correct_player_id, player_options"
    )
    .eq("tournament_id", room.tournament_id);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // 4b) My bonus answers (for this member) - only for questions we have
  const qIds = (bonusQs ?? []).map((q: any) => q.id);
  let myBonusAnswers: any[] = [];

  if (qIds.length > 0) {
    const { data: ans, error: aErr } = await supabaseServer
      .from("bonus_answers")
      .select("question_id, answer_number, answer_choice, answer_player_id")
      .eq("room_id", room.id)
      .eq("member_id", session.memberId)
      .in("question_id", qIds);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    myBonusAnswers = ans ?? [];
  }

  // 4c) Fetch player names for correct_player_id and answer_player_id
  const playerIds = new Set<string>();
  for (const q of bonusQs ?? []) {
    if (q.correct_player_id) playerIds.add(q.correct_player_id);
  }
  for (const a of myBonusAnswers) {
    if (a.answer_player_id) playerIds.add(a.answer_player_id);
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

  const myAnswerByQid = new Map<string, any>();
  for (const a of myBonusAnswers) myAnswerByQid.set(a.question_id, a);

  // 5) Settings
  const { data: settings } = await supabaseServer
    .from("admin_settings")
    .select("points_per_correct_1x2, points_per_correct_x")
    .eq("tournament_id", room.tournament_id)
    .single();

  const pointsPer = settings?.points_per_correct_1x2 ?? 1;
  const pointsPerX = settings?.points_per_correct_x ?? null; // null = nota pointsPer

  // 6) Members
  const { data: members, error: memErr } = await supabaseServer
    .from("room_members")
    .select("id, display_name, username")
    .eq("room_id", room.id);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  // 7) Predictions for room
  const { data: preds, error: pErr } = await supabaseServer
    .from("predictions")
    .select("member_id, match_id, pick")
    .eq("room_id", room.id);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // 7b) ALL bonus answers for ALL members (for leaderboard)
  let allBonusAnswers: any[] = [];
  if (qIds.length > 0) {
    const { data: allAns, error: allAErr } = await supabaseServer
      .from("bonus_answers")
      .select("member_id, question_id, answer_number, answer_choice, answer_player_id")
      .eq("room_id", room.id)
      .in("question_id", qIds);

    if (allAErr) return NextResponse.json({ error: allAErr.message }, { status: 500 });
    allBonusAnswers = allAns ?? [];
    
    // Add player IDs to playersMap
    for (const a of allBonusAnswers) {
      if (a.answer_player_id) playerIds.add(a.answer_player_id);
    }
    
    // Fetch all players needed
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
  }

  // --- Lookup maps
  const matchById = new Map((matches ?? []).map((x: any) => [x.id, x]));

  // bonus per match map (merge in my answers)
  const bonusByMatchId = new Map<string, any>();
  const bonusById = new Map<string, any>();
  for (const q of bonusQs ?? []) {
    const mine = myAnswerByQid.get(q.id);
    bonusById.set(q.id, q);
    const correctPlayer = q.correct_player_id ? playersMap.get(q.correct_player_id) : null;
    const myAnswerPlayer = mine?.answer_player_id ? playersMap.get(mine.answer_player_id) : null;
    
    // For player type, answer_choice contains player name
    let myAnswerPlayerName = null;
    if (q.type === "player") {
      myAnswerPlayerName = mine?.answer_choice ?? null;
    } else if (mine?.answer_player_id) {
      myAnswerPlayerName = myAnswerPlayer?.full_name ?? null;
    }
    
    // For player type, correct_choice contains the correct player name
    let correctPlayerName = correctPlayer?.full_name ?? null;
    if (q.type === "player" && q.correct_choice) {
      correctPlayerName = q.correct_choice;
    }
    
    bonusByMatchId.set(q.match_id, {
      ...q,
      my_answer_number: mine?.answer_number ?? null,
      my_answer_choice: mine?.answer_choice ?? null,
      my_answer_player_id: mine?.answer_player_id ?? null,
      my_answer_player_name: myAnswerPlayerName,
      correct_player_id: q.correct_player_id ?? null,
      correct_player_name: correctPlayerName,
    });
  }

  // --- My picks
  const myPicks = new Map<string, Pick>();
  for (const pr of preds ?? []) {
    if (pr.member_id === session.memberId) myPicks.set(pr.match_id, pr.pick as Pick);
  }

  // 8) Leaderboard (1X2 + bónus)
  const leaderboard = (members ?? []).map((m: any) => {
    let correct1x2 = 0;
    let points = 0;

    // 1X2 stig
    for (const pr of preds ?? []) {
      if (pr.member_id !== m.id) continue;
      const match = matchById.get(pr.match_id);
      if (!match?.result) continue;
      if (pr.pick === match.result) {
        correct1x2 += 1;
        // Ef X og pointsPerX er sett, nota það, annars nota pointsPer
        const pointsForThis = (pr.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;
        points += pointsForThis;
      }
    }

    // Bónus stig
    let bonusPoints = 0;
    for (const ans of allBonusAnswers ?? []) {
      if (ans.member_id !== m.id) continue;
      const question = bonusById.get(ans.question_id);
      if (!question) continue;

      // Athuga hvort rétt svar sé sett
      let isCorrect = false;
      if (question.type === "number" && question.correct_number != null) {
        isCorrect = ans.answer_number === question.correct_number;
      } else if (question.type === "choice" && question.correct_choice != null) {
        isCorrect = ans.answer_choice === question.correct_choice;
      } else if (question.type === "player" && question.correct_choice != null) {
        // Fyrir player type er bæði rétt svar og notandans svar í answer_choice/correct_choice (leikmannsnafn)
        isCorrect = ans.answer_choice === question.correct_choice;
      }

      if (isCorrect) {
        bonusPoints += question.points;
        points += question.points;
      }
    }

    return { memberId: m.id, displayName: m.display_name, username: m.username, points, correct1x2, bonusPoints };
  });

  leaderboard.sort(
    (a: any, b: any) =>
      b.points - a.points || b.correct1x2 - a.correct1x2 || a.displayName.localeCompare(b.displayName)
  );

  // 9) Return matches with myPick + bonus
  const matchesOut = (matches ?? []).map((m: any) => ({
    ...m,
    myPick: myPicks.get(m.id) ?? null,
    bonus: bonusByMatchId.get(m.id) ?? null,
  }));

  return NextResponse.json({
    room: { code: room.room_code, name: room.room_name },
    me,
    pointsPerCorrect1x2: pointsPer,
    pointsPerCorrectX: pointsPerX,
    matches: matchesOut,
    leaderboard,
  });
}
