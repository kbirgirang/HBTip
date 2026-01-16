import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

// API endpoint til að samstilla bónus svör fyrir alla meðlimi með sama username
// Þetta er admin endpoint sem uppfærir bónus svör fyrir alla meðlimi með sama username
export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) {
    return authError;
  }

  try {
    // Sækja öll bónus svör
    const { data: allBonusAnswers, error: bonusErr } = await supabaseServer
      .from("bonus_answers")
      .select("id, member_id, question_id, answer_number, answer_choice, answer_player_id, room_id");

    if (bonusErr) {
      return NextResponse.json({ error: bonusErr.message }, { status: 500 });
    }

    // Sækja alla meðlimi með username
    const { data: allMembers, error: memErr } = await supabaseServer
      .from("room_members")
      .select("id, room_id, username");

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    // Búa til map af username -> members
    const membersByUsername = new Map<string, Array<typeof allMembers[0]>>();
    for (const member of allMembers ?? []) {
      const username = (member.username as string).toLowerCase();
      if (!membersByUsername.has(username)) {
        membersByUsername.set(username, []);
      }
      membersByUsername.get(username)!.push(member);
    }

    // Fyrir hvert bónus svar, finna alla meðlimi með sama username og búa til svör fyrir þá
    // ATHUGIÐ: Við bætum AÐEINS við svörum ef þau eru ekki til staðar
    // Við yfirskrifum EKKI fyrirliggjandi svör
    const answersToSync: Array<{
      room_id: string;
      member_id: string;
      question_id: string;
      answer_number: number | null;
      answer_choice: string | null;
      answer_player_id: string | null;
    }> = [];

    // Búa til set af (member_id, question_id) fyrir fyrirliggjandi svör
    const existingAnswersSet = new Set<string>();
    for (const answer of allBonusAnswers ?? []) {
      existingAnswersSet.add(`${answer.member_id}:${answer.question_id}`);
    }

    // Fyrir hvert bónus svar, finna alla meðlimi með sama username
    for (const answer of allBonusAnswers ?? []) {
      const member = allMembers?.find((m) => m.id === answer.member_id);
      if (!member) continue;

      const username = (member.username as string).toLowerCase();
      const membersWithSameUsername = membersByUsername.get(username) ?? [];

      // Búa til svar fyrir alla meðlimi með sama username
      for (const otherMember of membersWithSameUsername) {
        const key = `${otherMember.id}:${answer.question_id}`;
        
        // AÐEINS bæta við svar ef það er EKKI þegar til staðar
        // Við yfirskrifum EKKI fyrirliggjandi svör
        if (!existingAnswersSet.has(key)) {
          answersToSync.push({
            room_id: otherMember.room_id,
            member_id: otherMember.id,
            question_id: answer.question_id,
            answer_number: answer.answer_number,
            answer_choice: answer.answer_choice,
            answer_player_id: answer.answer_player_id,
          });
          // Bæta við í set til að forðast duplicate inserts
          existingAnswersSet.add(key);
        }
      }
    }

    if (answersToSync.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "Öll bónus svör eru þegar samstillt",
        answersSynced: 0
      });
    }

    // Vista öll svör
    const { error: syncErr } = await supabaseServer
      .from("bonus_answers")
      .upsert(answersToSync, {
        onConflict: "member_id,question_id",
        ignoreDuplicates: false,
      });

    if (syncErr) {
      return NextResponse.json({ error: syncErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Samstillt ${answersToSync.length} bónus svör fyrir alla meðlimi með sama username`,
      answersSynced: answersToSync.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
