import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

// API endpoint til að samstilla spár fyrir alla meðlimi með sama username
// Þetta er admin endpoint sem uppfærir spár fyrir alla meðlimi með sama username
export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) {
    return authError;
  }

  try {
    // Sækja allar spár
    const { data: allPredictions, error: predErr } = await supabaseServer
      .from("predictions")
      .select("id, member_id, match_id, pick, room_id");

    if (predErr) {
      return NextResponse.json({ error: predErr.message }, { status: 500 });
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

    // Fyrir hverja spá, finna alla meðlimi með sama username og búa til spár fyrir þá
    // ATHUGIÐ: Við bætum AÐEINS við spám ef þær eru ekki til staðar
    // Við yfirskrifum EKKI fyrirliggjandi spár
    const predictionsToSync: Array<{
      room_id: string;
      member_id: string;
      match_id: string;
      pick: string;
    }> = [];

    // Búa til set af (member_id, match_id) fyrir fyrirliggjandi spár
    const existingPredsSet = new Set<string>();
    for (const pred of allPredictions ?? []) {
      existingPredsSet.add(`${pred.member_id}:${pred.match_id}`);
    }

    // Fyrir hverja spá, finna alla meðlimi með sama username
    for (const pred of allPredictions ?? []) {
      const member = allMembers?.find((m) => m.id === pred.member_id);
      if (!member) continue;

      const username = (member.username as string).toLowerCase();
      const membersWithSameUsername = membersByUsername.get(username) ?? [];

      // Búa til spá fyrir alla meðlimi með sama username
      for (const otherMember of membersWithSameUsername) {
        const key = `${otherMember.id}:${pred.match_id}`;
        
        // AÐEINS bæta við spá ef hún er EKKI þegar til staðar
        // Við yfirskrifum EKKI fyrirliggjandi spár
        if (!existingPredsSet.has(key)) {
          predictionsToSync.push({
            room_id: otherMember.room_id,
            member_id: otherMember.id,
            match_id: pred.match_id,
            pick: pred.pick,
          });
          // Bæta við í set til að forðast duplicate inserts
          existingPredsSet.add(key);
        }
      }
    }

    if (predictionsToSync.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "Allar spár eru þegar samstilltar",
        predictionsToSync: 0
      });
    }

    // Vista allar spár
    const { error: syncErr } = await supabaseServer
      .from("predictions")
      .upsert(predictionsToSync, {
        onConflict: "member_id,match_id",
        ignoreDuplicates: false,
      });

    if (syncErr) {
      return NextResponse.json({ error: syncErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Samstillt ${predictionsToSync.length} spár fyrir alla meðlimi með sama username`,
      predictionsSynced: predictionsToSync.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
