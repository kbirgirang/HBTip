import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Pick = "1" | "X" | "2";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  // ✅ Sækja username fyrir núverandi member
  const { data: currentMember, error: meErr } = await supabaseServer
    .from("room_members")
    .select("id, display_name, is_owner, username")
    .eq("id", session.memberId)
    .single();

  if (meErr || !currentMember) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  // ✅ Sækja allar deildir sem notandi er í með sama username
  const { data: allMyMembers, error: allErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id, display_name, is_owner")
    .ilike("username", currentMember.username);

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const roomIds = (allMyMembers ?? []).map((m: any) => m.room_id);
  if (roomIds.length === 0) {
    return NextResponse.json({ error: "Engar deildir fundust" }, { status: 404 });
  }

  // ✅ Sækja allar deildir
  const { data: rooms, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name, tournament_id")
    .in("id", roomIds);

  if (rErr || !rooms || rooms.length === 0) return NextResponse.json({ error: "Deildir fundust ekki" }, { status: 404 });

  // ✅ Sækja allar keppnir sem tengjast þessum deildum
  const tournamentIds = [...new Set(rooms.map((r: any) => r.tournament_id))];

  // ✅ Sækja allar leikir úr öllum keppnunum
  const { data: allMatches, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, match_no, stage, home_team, away_team, starts_at, allow_draw, result, underdog_team, underdog_multiplier, tournament_id")
    .in("tournament_id", tournamentIds)
    .order("match_no", { ascending: true, nullsFirst: false });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // ✅ Sækja allar bonus spurningar
  const { data: allBonusQs, error: bErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, match_id, title, type, points, closes_at, correct_number, choice_options, correct_choice, correct_player_id, player_options, tournament_id")
    .in("tournament_id", tournamentIds);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // ✅ Sækja allar spár fyrir ALLA meðlimi í öllum deildunum (ekki bara notandans)
  // Fyrst sækjum við alla meðlimi í öllum deildunum
  const { data: allRoomMembers, error: allMemErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id")
    .in("room_id", roomIds);

  if (allMemErr) return NextResponse.json({ error: allMemErr.message }, { status: 500 });

  const allMemberIds = (allMyMembers ?? []).map((m: any) => m.id);
  const allRoomMemberIds = (allRoomMembers ?? []).map((m: any) => m.id);
  
  // Sækja spár fyrir ALLA meðlimi í deildunum
  const { data: allPreds, error: pErr } = await supabaseServer
    .from("predictions")
    .select("member_id, match_id, pick, room_id")
    .in("member_id", allRoomMemberIds);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // ✅ Sækja allar settings fyrir allar keppnir
  const { data: allSettings, error: settingsErr } = await supabaseServer
    .from("admin_settings")
    .select("tournament_id, points_per_correct_1x2, points_per_correct_x")
    .in("tournament_id", tournamentIds);

  // ✅ Sækja bonus svör fyrir ALLA meðlimi í öllum deildunum (ekki bara notandans)
  const allQIds = (allBonusQs ?? []).map((q: any) => q.id);
  let allMyBonusAnswers: any[] = [];
  if (allQIds.length > 0 && allRoomMemberIds.length > 0) {
    const { data: ans, error: aErr } = await supabaseServer
      .from("bonus_answers")
      .select("question_id, answer_number, answer_choice, answer_player_id, room_id, member_id")
      .in("member_id", allRoomMemberIds)
      .in("question_id", allQIds);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    allMyBonusAnswers = ans ?? [];
  }

  // ✅ Sækja player nöfn
  const playerIds = new Set<string>();
  for (const q of allBonusQs ?? []) {
    if (q.correct_player_id) playerIds.add(q.correct_player_id);
  }
  for (const a of allMyBonusAnswers) {
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

  // ✅ Búa til gögn fyrir hverja deild
  const roomsData = await Promise.all(
    rooms.map(async (room: any) => {
      const roomMember = allMyMembers.find((m: any) => m.room_id === room.id);
      if (!roomMember) return null;

      // Leikir fyrir þessa keppni
      const roomMatches = (allMatches ?? []).filter((m: any) => m.tournament_id === room.tournament_id);

      // Settings fyrir þessa keppni
      const roomSettings = allSettings?.find((s: any) => s.tournament_id === room.tournament_id);
      const pointsPer = roomSettings?.points_per_correct_1x2 ?? 1;
      const pointsPerX = roomSettings?.points_per_correct_x ?? null;

      // Bonus spurningar fyrir þessa keppni
      const roomBonusQs = (allBonusQs ?? []).filter((q: any) => q.tournament_id === room.tournament_id);
      const roomQIds = roomBonusQs.map((q: any) => q.id);

      // Bonus svör fyrir þessa deild
      const roomBonusAnswers = allMyBonusAnswers.filter((a: any) => a.room_id === room.id && a.member_id === roomMember.id);
      const myAnswerByQid = new Map<string, any>();
      for (const a of roomBonusAnswers) myAnswerByQid.set(a.question_id, a);

      // Bonus per match map
      const bonusByMatchId = new Map<string, any>();
      const bonusById = new Map<string, any>();
      for (const q of roomBonusQs) {
        const mine = myAnswerByQid.get(q.id);
        bonusById.set(q.id, q);
        const correctPlayer = q.correct_player_id ? playersMap.get(q.correct_player_id) : null;
        const myAnswerPlayer = mine?.answer_player_id ? playersMap.get(mine.answer_player_id) : null;

        let myAnswerPlayerName = null;
        if (q.type === "player") {
          myAnswerPlayerName = mine?.answer_choice ?? null;
        } else if (mine?.answer_player_id) {
          myAnswerPlayerName = myAnswerPlayer?.full_name ?? null;
        }

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

      // Spár fyrir þessa deild
      const roomPreds = (allPreds ?? []).filter((pr: any) => pr.room_id === room.id);
      const myPicks = new Map<string, Pick>();
      for (const pr of roomPreds) {
        if (pr.member_id === roomMember.id) myPicks.set(pr.match_id, pr.pick as Pick);
      }

      // Members fyrir þessa deild
      const { data: roomMembers, error: memErr } = await supabaseServer
        .from("room_members")
        .select("id, display_name, username")
        .eq("room_id", room.id);

      if (memErr) return null;

      // Leaderboard fyrir þessa deild
      const matchById = new Map(roomMatches.map((x: any) => [x.id, x]));

      // All bonus answers fyrir þessa deild (fyrir leaderboard)
      let allRoomBonusAnswers: any[] = [];
      if (roomQIds.length > 0) {
        const { data: allAns, error: allAErr } = await supabaseServer
          .from("bonus_answers")
          .select("member_id, question_id, answer_number, answer_choice, answer_player_id")
          .eq("room_id", room.id)
          .in("question_id", roomQIds);

        if (!allAErr && allAns) {
          allRoomBonusAnswers = allAns;

          // Add player IDs to playersMap
          for (const a of allRoomBonusAnswers) {
            if (a.answer_player_id) playerIds.add(a.answer_player_id);
          }

          // Fetch additional players if needed
          const additionalPlayerIds = Array.from(playerIds).filter((id) => !playersMap.has(id));
          if (additionalPlayerIds.length > 0) {
            const { data: additionalPlayers, error: addPErr } = await supabaseServer
              .from("players")
              .select("id, full_name")
              .in("id", additionalPlayerIds);
            if (!addPErr && additionalPlayers) {
              for (const p of additionalPlayers) {
                playersMap.set(p.id, p);
              }
            }
          }
        }
      }

      const leaderboard = (roomMembers ?? []).map((m: any) => {
        let correct1x2 = 0;
        let points1x2 = 0;
        let points = 0;

        // 1X2 stig
        for (const pr of roomPreds) {
          if (pr.member_id !== m.id) continue;
          const match = matchById.get(pr.match_id);
          if (!match?.result) continue;
          if (pr.pick === match.result) {
            correct1x2 += 1;
            let pointsForThis = (pr.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;

            if (match.underdog_team && match.underdog_multiplier && pr.pick === match.underdog_team && match.result === match.underdog_team) {
              pointsForThis = Math.round(pointsForThis * match.underdog_multiplier);
            }

            points1x2 += pointsForThis;
            points += pointsForThis;
          }
        }

        // Bónus stig
        let bonusPoints = 0;
        for (const ans of allRoomBonusAnswers ?? []) {
          if (ans.member_id !== m.id) continue;
          const question = bonusById.get(ans.question_id);
          if (!question) continue;

          const match = matchById.get(question.match_id);
          if (!match || !match.result) continue;

          let isCorrect = false;
          if (question.type === "number" && question.correct_number != null) {
            isCorrect = ans.answer_number === question.correct_number;
          } else if (question.type === "choice" && question.correct_choice != null) {
            isCorrect = ans.answer_choice === question.correct_choice;
          } else if (question.type === "player" && question.correct_choice != null) {
            isCorrect = ans.answer_choice === question.correct_choice;
          }

          if (isCorrect) {
            bonusPoints += question.points;
            points += question.points;
          }
        }

        return { memberId: m.id, displayName: m.display_name, username: m.username, points, correct1x2, points1x2, bonusPoints };
      });

      leaderboard.sort(
        (a: any, b: any) =>
          b.points - a.points || b.correct1x2 - a.correct1x2 || a.displayName.localeCompare(b.displayName)
      );

      // Debug: Athuga hvort allir meðlimir séu í stigatöflunni
      // console.log(`Room ${room.room_code}: ${roomMembers?.length ?? 0} members, ${leaderboard.length} in leaderboard`);

      return {
        room: { code: room.room_code, name: room.room_name },
        me: { id: roomMember.id, display_name: roomMember.display_name, is_owner: roomMember.is_owner, username: currentMember.username },
        pointsPerCorrect1x2: pointsPer,
        pointsPerCorrectX: pointsPerX,
        matches: roomMatches.map((m: any) => ({
          ...m,
          myPick: myPicks.get(m.id) ?? null,
          bonus: bonusByMatchId.get(m.id) ?? null,
        })),
        leaderboard,
      };
    })
  );

  const validRoomsData = roomsData.filter((r: any) => r !== null);

  // Return first room as "current" for backwards compatibility, but also include all rooms
  return NextResponse.json({
    room: validRoomsData[0]?.room ?? { code: session.roomCode, name: "" },
    me: currentMember,
    pointsPerCorrect1x2: validRoomsData[0]?.pointsPerCorrect1x2 ?? 1,
    pointsPerCorrectX: validRoomsData[0]?.pointsPerCorrectX ?? null,
    matches: validRoomsData[0]?.matches ?? [],
    leaderboard: validRoomsData[0]?.leaderboard ?? [],
    // ✅ Nýtt: allar deildir
    allRooms: validRoomsData,
  });
}
