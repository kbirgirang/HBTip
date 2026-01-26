import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Pick = "1" | "X" | "2";

/**
 * Léttur endpoint sem skilar aðeins stigatöflum. Notaður fyrir hröð uppfærslu á
 * stigatöflum án þess að sækja alla view (leiki, spár, bónus o.fl.).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  const { data: currentMember, error: meErr } = await supabaseServer
    .from("room_members")
    .select("id, username")
    .eq("id", session.memberId)
    .single();

  if (meErr || !currentMember) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  const { data: allMyMembers, error: allErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id")
    .ilike("username", currentMember.username);

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const roomIds = (allMyMembers ?? []).map((m: any) => m.room_id);
  if (roomIds.length === 0) return NextResponse.json({ error: "Engar deildir fundust" }, { status: 404 });

  const { data: rooms, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name, tournament_id")
    .in("id", roomIds);

  if (rErr || !rooms?.length) return NextResponse.json({ error: "Deildir fundust ekki" }, { status: 404 });

  const tournamentIds = [...new Set(rooms.map((r: any) => r.tournament_id))];

  const [
    { data: allMatches, error: mErr },
    { data: allBonusQs, error: bErr },
    { data: allRoomMembers, error: allMemErr },
  ] = await Promise.all([
    supabaseServer
      .from("matches")
      .select("id, result, underdog_team, underdog_multiplier, tournament_id")
      .in("tournament_id", tournamentIds),
    supabaseServer
      .from("bonus_questions")
      .select("id, match_id, type, points, correct_number, correct_choice, tournament_id")
      .in("tournament_id", tournamentIds),
    supabaseServer
      .from("room_members")
      .select("id, room_id, display_name, username")
      .in("room_id", roomIds),
  ]);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (allMemErr) return NextResponse.json({ error: allMemErr.message }, { status: 500 });

  const allRoomMemberIds = (allRoomMembers ?? []).map((m: any) => m.id);

  const [
    { data: allPreds, error: pErr },
    { data: allSettings, error: settingsErr },
  ] = await Promise.all([
    supabaseServer
      .from("predictions")
      .select("member_id, match_id, pick, room_id")
      .in("member_id", allRoomMemberIds),
    supabaseServer
      .from("admin_settings")
      .select("tournament_id, points_per_correct_1x2, points_per_correct_x")
      .in("tournament_id", tournamentIds),
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (settingsErr) return NextResponse.json({ error: settingsErr.message }, { status: 500 });

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

  const bonusById = new Map((allBonusQs ?? []).map((q: any) => [q.id, q]));

  type LeaderboardEntry = { memberId: string; displayName: string; username: string; points: number; correct1x2: number; points1x2: number; bonusPoints: number };
  const result: { room: { code: string }; leaderboard: LeaderboardEntry[] }[] = [];

  for (const room of rooms) {
    const roomMember = allMyMembers!.find((m: any) => m.room_id === room.id);
    if (!roomMember) continue;

    const roomMatches = (allMatches ?? []).filter((m: any) => m.tournament_id === room.tournament_id);
    const roomSettings = allSettings?.find((s: any) => s.tournament_id === room.tournament_id);
    const pointsPer = roomSettings?.points_per_correct_1x2 ?? 1;
    const pointsPerX = roomSettings?.points_per_correct_x ?? null;
    const roomBonusQs = (allBonusQs ?? []).filter((q: any) => q.tournament_id === room.tournament_id);
    const roomQIds = roomBonusQs.map((q: any) => q.id);
    const roomAllBonusAnswers = allBonusAnswersByRoom.get(room.id) ?? [];
    const roomPreds = (allPreds ?? []).filter((pr: any) => pr.room_id === room.id);
    const roomMembers = (allRoomMembers ?? []).filter((m: any) => m.room_id === room.id);

    const matchById = new Map(roomMatches.map((x: any) => [x.id, x]));

    // Búa til map af username -> member_ids í SÖMU keppni (fyrir fallback)
    // Þetta gerir okkur kleift að finna spár hjá öllum members með sama username í sömu keppni
    // ATHUGIÐ: Ekki leita í öllum deildum, bara í sömu keppni (tournament_id)
    const usernameToMemberIds = new Map<string, string[]>();
    for (const m of allRoomMembers ?? []) {
      // Aðeins bæta við members sem eru í sömu keppni
      const memberRoom = rooms.find((r: any) => r.id === m.room_id);
      if (memberRoom && memberRoom.tournament_id === room.tournament_id) {
        const uname = (m.username as string).toLowerCase();
        if (!usernameToMemberIds.has(uname)) {
          usernameToMemberIds.set(uname, []);
        }
        usernameToMemberIds.get(uname)!.push(m.id);
      }
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
        
        // Fallback: ef spá finnst ekki, leita að spá hjá öllum members með sama username
        if (!foundPred) {
          foundPred = (allPreds ?? []).find((pr: any) => 
            pr.match_id === match.id && 
            allMemberIdsWithSameUsername.includes(pr.member_id)
          );
        }
        
        // Ef spá fannst og hún er rétt, reikna stig
        if (foundPred && foundPred.pick === match.result) {
          processedMatches.add(match.id);
          correct1x2 += 1;
          let pts = (foundPred.pick === "X" && pointsPerX != null) ? pointsPerX : pointsPer;
          if (match.underdog_team && match.underdog_multiplier && foundPred.pick === match.underdog_team && match.result === match.underdog_team) {
            pts = Math.round(pts * match.underdog_multiplier);
          }
          points1x2 += pts;
          points += pts;
        }
      }

      // Bónus stig - fyrst reyna að finna bonus svör með réttum member_id
      let bonusPoints = 0;
      const processedBonusQuestions = new Set<string>();
      
      for (const ans of roomAllBonusAnswers) {
        if (ans.member_id !== m.id) continue;
        const question = bonusById.get(ans.question_id);
        if (!question) continue;
        const match = matchById.get(question.match_id);
        if (!match || !match.result) continue;
        
        processedBonusQuestions.add(ans.question_id);
        
        let isCorrect = false;
        if (question.type === "number" && question.correct_number != null) {
          isCorrect = ans.answer_number === question.correct_number;
        } else if ((question.type === "choice" || question.type === "player") && question.correct_choice != null) {
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
          } else if ((question.type === "choice" || question.type === "player") && question.correct_choice != null) {
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

    result.push({ room: { code: room.room_code }, leaderboard });
  }

  return NextResponse.json({ allRooms: result });
}
