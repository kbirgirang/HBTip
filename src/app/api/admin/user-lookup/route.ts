import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

/**
 * Endpoint sem sækir notanda eftir username og skilar stöðu í öllum deildum sem hann er í.
 */
export async function GET(req: Request) {
  const authError = await requireAdminSession();
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username || username.trim() === "") {
    return NextResponse.json({ error: "Username vantar" }, { status: 400 });
  }

  try {
    // Sækja alla meðlimi með sama username
    const { data: members, error: memErr } = await supabaseServer
      .from("room_members")
      .select("id, room_id, display_name, username, is_owner")
      .ilike("username", username.trim());

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ 
        error: "Notandi fannst ekki",
        username: username.trim(),
        rooms: []
      }, { status: 404 });
    }

    const roomIds = members.map((m) => m.room_id);
    const memberIds = members.map((m) => m.id);

    // Sækja allar deildir
    const { data: rooms, error: rErr } = await supabaseServer
      .from("rooms")
      .select("id, room_code, room_name, tournament_id")
      .in("id", roomIds);

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    const tournamentIds = [...new Set(rooms?.map((r) => r.tournament_id) ?? [])];

    // Sækja allar keppnir
    const { data: tournaments, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id, name, slug")
      .in("id", tournamentIds);

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    const tournamentMap = new Map((tournaments ?? []).map((t) => [t.id, t]));

    // Sækja allar leikir
    const { data: allMatches, error: mErr } = await supabaseServer
      .from("matches")
      .select("id, match_no, stage, home_team, away_team, starts_at, result, tournament_id")
      .in("tournament_id", tournamentIds);

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    // Sækja allar spár
    const { data: allPredictions, error: pErr } = await supabaseServer
      .from("predictions")
      .select("member_id, match_id, pick, room_id")
      .in("member_id", memberIds);

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Sækja allar settings
    const { data: allSettings, error: sErr } = await supabaseServer
      .from("admin_settings")
      .select("tournament_id, points_per_correct_1x2, points_per_correct_x")
      .in("tournament_id", tournamentIds);

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    // Sækja allar bonus spurningar
    const { data: allBonusQs, error: bErr } = await supabaseServer
      .from("bonus_questions")
      .select("id, match_id, type, points, correct_number, correct_choice, tournament_id")
      .in("tournament_id", tournamentIds);

    if (bErr) {
      return NextResponse.json({ error: bErr.message }, { status: 500 });
    }

    // Sækja allar bonus svör
    const allQIds = (allBonusQs ?? []).map((q) => q.id);
    let allBonusAnswers: any[] = [];
    if (allQIds.length > 0) {
      const { data: ans, error: aErr } = await supabaseServer
        .from("bonus_answers")
        .select("member_id, question_id, answer_number, answer_choice, room_id")
        .in("member_id", memberIds)
        .in("question_id", allQIds);

      if (aErr) {
        return NextResponse.json({ error: aErr.message }, { status: 500 });
      }
      allBonusAnswers = ans ?? [];
    }

    // Búa til gögn fyrir hverja deild
    const roomsData = await Promise.all((rooms ?? []).map(async (room) => {
      const member = members.find((m) => m.room_id === room.id);
      if (!member) return null;

      const tournament = tournamentMap.get(room.tournament_id);
      const roomMatches = (allMatches ?? []).filter((m) => m.tournament_id === room.tournament_id);
      const roomSettings = allSettings?.find((s) => s.tournament_id === room.tournament_id);
      const pointsPer = roomSettings?.points_per_correct_1x2 ?? 1;
      const pointsPerX = roomSettings?.points_per_correct_x ?? null;
      const roomBonusQs = (allBonusQs ?? []).filter((q) => q.tournament_id === room.tournament_id);
      const roomPredictions = (allPredictions ?? []).filter((p) => p.room_id === room.id && p.member_id === member.id);
      const roomBonusAnswers = allBonusAnswers.filter((a) => a.room_id === room.id && a.member_id === member.id);

      const matchById = new Map(roomMatches.map((m) => [m.id, m]));
      const bonusById = new Map(roomBonusQs.map((q) => [q.id, q]));

      // Reikna stig
      let correct1x2 = 0;
      let points1x2 = 0;
      let totalPoints = 0;

      for (const pred of roomPredictions) {
        const match = matchById.get(pred.match_id);
        if (!match?.result) continue;
        if (pred.pick === match.result) {
          correct1x2 += 1;
          const pts = (pred.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;
          points1x2 += pts;
          totalPoints += pts;
        }
      }

      let bonusPoints = 0;
      for (const ans of roomBonusAnswers) {
        const question = bonusById.get(ans.question_id);
        if (!question) continue;
        const match = matchById.get(question.match_id);
        if (!match?.result) continue;

        let isCorrect = false;
        if (question.type === "number" && question.correct_number != null) {
          isCorrect = ans.answer_number === question.correct_number;
        } else if ((question.type === "choice" || question.type === "player") && question.correct_choice != null) {
          isCorrect = ans.answer_choice === question.correct_choice;
        }

        if (isCorrect) {
          bonusPoints += question.points;
          totalPoints += question.points;
        }
      }

      // Sækja stöðu í leaderboard - sækja meðlimi í þessari deild beint
      const { data: roomMembersData } = await supabaseServer
        .from("room_members")
        .select("id, display_name")
        .eq("room_id", room.id);
      
      const allRoomMemberIds = (roomMembersData ?? []).map((m) => m.id);
      const allRoomPreds = (allPredictions ?? []).filter((p) => p.room_id === room.id && allRoomMemberIds.includes(p.member_id));

      // Reikna stöðu fyrir alla meðlimi
      const leaderboard = (roomMembersData ?? []).map((m) => {
        let mCorrect1x2 = 0;
        let mPoints1x2 = 0;
        let mPoints = 0;

        for (const pr of allRoomPreds) {
          if (pr.member_id !== m.id) continue;
          const match = matchById.get(pr.match_id);
          if (!match?.result) continue;
          if (pr.pick === match.result) {
            mCorrect1x2 += 1;
            const pts = (pr.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;
            mPoints1x2 += pts;
            mPoints += pts;
          }
        }

        // Bonus stig
        const mBonusAnswers = allBonusAnswers.filter((a) => a.room_id === room.id && a.member_id === m.id);
        for (const ans of mBonusAnswers) {
          const question = bonusById.get(ans.question_id);
          if (!question) continue;
          const match = matchById.get(question.match_id);
          if (!match?.result) continue;

          let isCorrect = false;
          if (question.type === "number" && question.correct_number != null) {
            isCorrect = ans.answer_number === question.correct_number;
          } else if ((question.type === "choice" || question.type === "player") && question.correct_choice != null) {
            isCorrect = ans.answer_choice === question.correct_choice;
          }

          if (isCorrect) {
            mPoints += question.points;
          }
        }

        return { memberId: m.id, displayName: m.display_name, points: mPoints, correct1x2: mCorrect1x2, points1x2: mPoints1x2 };
      });

      leaderboard.sort((a, b) => b.points - a.points || b.correct1x2 - a.correct1x2 || a.displayName.localeCompare(b.displayName));
      const rank = leaderboard.findIndex((l) => l.memberId === member.id) + 1;

      return {
        room: {
          code: room.room_code,
          name: room.room_name,
        },
        tournament: tournament ? { name: tournament.name, slug: tournament.slug } : null,
        member: {
          id: member.id,
          displayName: member.display_name,
          isOwner: member.is_owner,
        },
        stats: {
          rank,
          totalPoints,
          points1x2,
          bonusPoints,
          correct1x2,
          totalMatches: roomMatches.length,
          matchesWithResult: roomMatches.filter((m) => m.result != null).length,
          predictionsMade: roomPredictions.length,
          bonusAnswersMade: roomBonusAnswers.length,
        },
        predictions: roomPredictions.map((p) => {
          const match = matchById.get(p.match_id);
          return {
            matchId: p.match_id,
            matchNo: match?.match_no,
            stage: match?.stage,
            homeTeam: match?.home_team,
            awayTeam: match?.away_team,
            startsAt: match?.starts_at,
            result: match?.result,
            pick: p.pick,
            isCorrect: match?.result ? p.pick === match.result : null,
          };
        }),
      };
    }).filter((r) => r !== null);

    return NextResponse.json({
      ok: true,
      username: username.trim(),
      displayName: members[0]?.display_name,
      rooms: validRoomsData,
    });
  } catch (error: any) {
    console.error("Error in user-lookup:", error);
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
