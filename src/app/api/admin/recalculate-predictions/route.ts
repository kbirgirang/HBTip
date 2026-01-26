import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

/**
 * Endpoint sem endurreiknar og samstillir ALLAR spár fyrir ALLA notendur.
 * 
 * Þetta:
 * 1. Sækir allar spár sem eru til staðar
 * 2. Fyrir hverja spá, finnur alla meðlimi með sama username
 * 3. Býr til spár fyrir ALLA meðlimi með sama username (yfirskrifar ef þarf)
 * 
 * ATHUGIÐ: Þetta getur tekið tíma ef mikið af gögnum eru til staðar.
 */
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

    // Búa til map af member_id -> username (fyrir fljótlegan lookup)
    const memberIdToUsername = new Map<string, string>();
    for (const member of allMembers ?? []) {
      memberIdToUsername.set(member.id, (member.username as string).toLowerCase());
    }

    // Búa til map af fyrirliggjandi spám: (member_id, match_id) -> pick
    const existingPredictions = new Map<string, string>();
    for (const pred of allPredictions ?? []) {
      existingPredictions.set(`${pred.member_id}:${pred.match_id}`, pred.pick);
    }

    // Fyrir hverja spá, finna alla meðlimi með sama username og búa til spár fyrir þá
    // ✅ ÖRYGGISVÖRN: Yfirskrifum EKKI ef spá er þegar til og er SÖMU
    // ✅ Yfirskrifum AÐEINS ef spá er mismunandi (bugg sem þarf að laga)
    const predictionsToSync: Array<{
      room_id: string;
      member_id: string;
      match_id: string;
      pick: string;
    }> = [];

    // Fyrir hverja spá sem er til staðar
    for (const pred of allPredictions ?? []) {
      const username = memberIdToUsername.get(pred.member_id);
      if (!username) continue;

      const membersWithSameUsername = membersByUsername.get(username) ?? [];

      // Búa til spá fyrir ALLA meðlimi með sama username
      for (const otherMember of membersWithSameUsername) {
        const key = `${otherMember.id}:${pred.match_id}`;
        const existingPick = existingPredictions.get(key);
        
        // AÐEINS bæta við ef:
        // 1. Spá er ekki til staðar, EÐA
        // 2. Spá er til staðar en er MISMUNANDI (bugg sem þarf að laga)
        if (!existingPick || existingPick !== pred.pick) {
          predictionsToSync.push({
            room_id: otherMember.room_id,
            member_id: otherMember.id,
            match_id: pred.match_id,
            pick: pred.pick,
          });
        }
      }
    }

    if (predictionsToSync.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "Engar spár fundust til að samstilla",
        predictionsSynced: 0
      });
    }

    // ✅ Vista allar spár (yfirskrifar ef þær eru til staðar)
    // Nota upsert með ignoreDuplicates: false til að yfirskrifa
    const { error: syncErr } = await supabaseServer
      .from("predictions")
      .upsert(predictionsToSync, {
        onConflict: "member_id,match_id",
        ignoreDuplicates: false, // ✅ Yfirskrifa fyrirliggjandi spár
      });

    if (syncErr) {
      console.error("Error recalculating predictions:", syncErr);
      return NextResponse.json({ error: syncErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Endurreiknaði og samstillti ${predictionsToSync.length} spár fyrir alla meðlimi með sama username`,
      predictionsSynced: predictionsToSync.length,
      totalPredictions: allPredictions?.length || 0,
      totalMembers: allMembers?.length || 0,
    });
  } catch (error: any) {
    console.error("Unexpected error in recalculate-predictions:", error);
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
