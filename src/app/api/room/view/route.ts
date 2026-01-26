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
    .select("id, match_no, stage, home_team, away_team, starts_at, allow_draw, result, underdog_team, underdog_multiplier, tournament_id, home_score, away_score")
    .in("tournament_id", tournamentIds)
    .order("match_no", { ascending: true, nullsFirst: false });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // ✅ Sækja allar bonus spurningar
  const { data: allBonusQs, error: bErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, match_id, title, type, points, closes_at, correct_number, choice_options, correct_choice, correct_player_id, player_options, tournament_id")
    .in("tournament_id", tournamentIds);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // ✅ Sækja alla meðlimi í öllum deildunum (eitt kall – nota fyrir spár og leaderboard)
  const { data: allRoomMembers, error: allMemErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id, display_name, username")
    .in("room_id", roomIds);

  if (allMemErr) return NextResponse.json({ error: allMemErr.message }, { status: 500 });

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

  // ✅ Sækja öll bonus svör fyrir ALLA meðlimi í öllum deildunum (eitt kall – nota fyrir bæði „mín" og leaderboard)
  const allQIds = (allBonusQs ?? []).map((q: any) => q.id);
  let allBonusAnswersByRoom: Map<string, any[]> = new Map();
  let allBonusAnswers: any[] = []; // Geyma öll bonus svör fyrir fallback
  if (allQIds.length > 0 && allRoomMemberIds.length > 0) {
    const { data: ans, error: aErr } = await supabaseServer
      .from("bonus_answers")
      .select("question_id, answer_number, answer_choice, answer_player_id, room_id, member_id")
      .in("member_id", allRoomMemberIds)
      .in("question_id", allQIds);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    const list = ans ?? [];
    allBonusAnswers = list; // Geyma öll bonus svör
    for (const a of list) {
      const rid = (a as any).room_id;
      if (!allBonusAnswersByRoom.has(rid)) allBonusAnswersByRoom.set(rid, []);
      allBonusAnswersByRoom.get(rid)!.push(a);
    }
  }

  // ✅ Sækja player nöfn
  const playerIds = new Set<string>();
  for (const q of allBonusQs ?? []) {
    if (q.correct_player_id) playerIds.add(q.correct_player_id);
  }
  for (const arr of allBonusAnswersByRoom.values()) {
    for (const a of arr) {
      if ((a as any).answer_player_id) playerIds.add((a as any).answer_player_id);
    }
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

      // Bonus svör fyrir þessa deild (mín + öll fyrir leaderboard)
      const roomAllBonusAnswers = allBonusAnswersByRoom.get(room.id) ?? [];
      const roomBonusAnswers = roomAllBonusAnswers.filter((a: any) => a.member_id === roomMember.id);
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
      
      // Fyrst: reyna að finna spár fyrir réttan member í þessari deild
      for (const pr of roomPreds) {
        if (pr.member_id === roomMember.id) {
          myPicks.set(pr.match_id, pr.pick as Pick);
        }
      }
      
      // Fallback: ef leikur er í þessari keppni en spá finnst ekki fyrir þennan member,
      // reyna að finna spá hjá öðrum member með sama username (fyrir sama match_id)
      // Þetta gerist ef notandi er í mörgum deildum í sömu keppni og spáin er geymd fyrir aðra deild
      const allMyMemberIds = (allMyMembers ?? []).map((m: any) => m.id);
      for (const match of roomMatches) {
        if (!myPicks.has(match.id)) {
          // Leita að spá hjá öllum members með sama username (í öllum deildum)
          for (const pr of allPreds ?? []) {
            if (pr.match_id === match.id && allMyMemberIds.includes(pr.member_id)) {
              myPicks.set(match.id, pr.pick as Pick);
              break; // Nota fyrstu spá sem finnst
            }
          }
        }
      }

      // Members fyrir þessa deild (úr sameinuðu sækingu)
      const roomMembers = (allRoomMembers ?? []).filter((m: any) => m.room_id === room.id);

      // ✅ Búa til map af spám allra meðlima fyrir hvern leik
      const picksByMatchId = new Map<string, Array<{ memberId: string; displayName: string; pick: Pick }>>();
      for (const pr of roomPreds) {
        const member = roomMembers.find((m: any) => m.id === pr.member_id);
        if (!member) continue;
        
        if (!picksByMatchId.has(pr.match_id)) {
          picksByMatchId.set(pr.match_id, []);
        }
        picksByMatchId.get(pr.match_id)!.push({
          memberId: member.id,
          displayName: member.display_name,
          pick: pr.pick as Pick,
        });
      }

      // Leaderboard fyrir þessa deild (notum roomAllBonusAnswers – engin aukaleg fyrirspurn)
      const matchById = new Map(roomMatches.map((x: any) => [x.id, x]));
      const allRoomBonusAnswers = roomAllBonusAnswers;

      // Búa til map af username -> member_ids í ÖLLUM deildunum (fyrir fallback)
      // Þetta gerir okkur kleift að finna spár hjá öllum members með sama username
      const usernameToMemberIds = new Map<string, string[]>();
      for (const m of allRoomMembers ?? []) {
        const uname = (m.username as string).toLowerCase();
        if (!usernameToMemberIds.has(uname)) {
          usernameToMemberIds.set(uname, []);
        }
        usernameToMemberIds.get(uname)!.push(m.id);
      }

      const leaderboard = roomMembers.map((m: any) => {
        let correct1x2 = 0;
        let points1x2 = 0;
        let points = 0;

        // Búa til set af match_ids sem við höfum þegar reiknað (til að forðast duplicate stig)
        const processedMatches = new Set<string>();
        const memberUsername = (m.username as string).toLowerCase();
        const allMemberIdsWithSameUsername = usernameToMemberIds.get(memberUsername) ?? [];

        // 1X2 stig - leita að spá fyrir hvern leik
        for (const match of roomMatches) {
          if (!match.result || processedMatches.has(match.id)) continue;
          
          // Fyrst: reyna að finna spá með réttum member_id í þessari deild
          let foundPred = roomPreds.find((pr: any) => pr.member_id === m.id && pr.match_id === match.id);
          let usedFallback = false;
          
          // Fallback: ef spá finnst ekki, leita að spá hjá öllum members með sama username
          if (!foundPred && allMemberIdsWithSameUsername.length > 0) {
            foundPred = (allPreds ?? []).find((pr: any) => 
              pr.match_id === match.id && 
              allMemberIdsWithSameUsername.includes(pr.member_id)
            );
            if (foundPred) usedFallback = true;
          }
          
          // Ef spá fannst og hún er rétt, reikna stig
          if (foundPred && foundPred.pick === match.result) {
            processedMatches.add(match.id);
            correct1x2 += 1;
            let pointsForThis = (foundPred.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;

            if (match.underdog_team && match.underdog_multiplier && foundPred.pick === match.underdog_team && match.result === match.underdog_team) {
              pointsForThis = Math.round(pointsForThis * match.underdog_multiplier);
            }

            points1x2 += pointsForThis;
            points += pointsForThis;
          }
        }

        // Bónus stig - fyrst reyna að finna bonus svör með réttum member_id
        let bonusPoints = 0;
        const processedBonusQuestions = new Set<string>();
        
        for (const ans of allRoomBonusAnswers ?? []) {
          if (ans.member_id !== m.id) continue;
          const question = bonusById.get(ans.question_id);
          if (!question) continue;

          const match = matchById.get(question.match_id);
          if (!match || !match.result) continue;
          
          processedBonusQuestions.add(ans.question_id);

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
        
        // Fallback: ef bonus spurning finnst ekki með réttum member_id,
        // leita að bonus svari hjá öllum members með sama username
        for (const question of roomBonusQs) {
          if (processedBonusQuestions.has(question.id)) continue;
          const match = matchById.get(question.match_id);
          if (!match || !match.result) continue;
          
          // Leita að bonus svari hjá öllum members með sama username
          const foundAns = (allBonusAnswers ?? []).find((ans: any) => 
            ans.question_id === question.id && 
            allMemberIdsWithSameUsername.includes(ans.member_id)
          );
          
          if (foundAns) {
            processedBonusQuestions.add(question.id);
            let isCorrect = false;
            if (question.type === "number" && question.correct_number != null) {
              isCorrect = foundAns.answer_number === question.correct_number;
            } else if (question.type === "choice" && question.correct_choice != null) {
              isCorrect = foundAns.answer_choice === question.correct_choice;
            } else if (question.type === "player" && question.correct_choice != null) {
              isCorrect = foundAns.answer_choice === question.correct_choice;
            }
            
            if (isCorrect) {
              bonusPoints += question.points;
              points += question.points;
            }
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
          // ✅ Spár allra meðlima fyrir þennan leik
          memberPicks: picksByMatchId.get(m.id) ?? [],
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
