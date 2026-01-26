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
    // ✅ ÖRYGGISVÖRN: Bætum AÐEINS við spám sem VANTAR
    // ✅ Yfirskrifum EKKI fyrirliggjandi spár (jafnvel ef þær eru mismunandi)
    // ✅ Nota Map til að forðast duplicates (sama member_id + match_id tvisvar)
    const predictionsToSyncMap = new Map<string, {
      room_id: string;
      member_id: string;
      match_id: string;
      pick: string;
    }>();

    // Fyrir hverja spá sem er til staðar
    for (const pred of allPredictions ?? []) {
      const username = memberIdToUsername.get(pred.member_id);
      if (!username) continue;

      const membersWithSameUsername = membersByUsername.get(username) ?? [];

      // Búa til spá fyrir ALLA meðlimi með sama username
      for (const otherMember of membersWithSameUsername) {
        const key = `${otherMember.id}:${pred.match_id}`;
        
        // ✅ Forðast að búa til duplicate - ef key er þegar í Map, sleppa
        if (predictionsToSyncMap.has(key)) continue;
        
        const existingPick = existingPredictions.get(key);
        
        // ✅ AÐEINS bæta við ef spá er EKKI til staðar
        // ✅ Yfirskrifum EKKI fyrirliggjandi spár (jafnvel ef þær eru mismunandi)
        // Þetta tryggir að við breytum ekki stigum sem eru þegar rétt
        if (!existingPick) {
          // Nota key sem unique identifier til að forðast duplicates
          predictionsToSyncMap.set(key, {
            room_id: otherMember.room_id,
            member_id: otherMember.id,
            match_id: pred.match_id,
            pick: pred.pick,
          });
        }
      }
    }

    // Breyta Map í array
    const predictionsToSync = Array.from(predictionsToSyncMap.values());

    if (predictionsToSync.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "Engar spár fundust til að samstilla",
        predictionsSynced: 0
      });
    }

    // ✅ Vista allar spár í batch (yfirskrifar ef þær eru til staðar)
    // Nota batch upsert til að forðast "cannot affect row a second time" villu
    // Batch size: 1000 (Supabase takmarkar stærð)
    const BATCH_SIZE = 1000;
    let totalSynced = 0;
    
    for (let i = 0; i < predictionsToSync.length; i += BATCH_SIZE) {
      const batch = predictionsToSync.slice(i, i + BATCH_SIZE);
      
      const { error: syncErr } = await supabaseServer
        .from("predictions")
        .upsert(batch, {
          onConflict: "member_id,match_id",
          ignoreDuplicates: false, // ✅ Yfirskrifa fyrirliggjandi spár
        });

      if (syncErr) {
        console.error(`Error recalculating predictions (batch ${i / BATCH_SIZE + 1}):`, syncErr);
        return NextResponse.json({ 
          error: `Villa við að vista spár (batch ${i / BATCH_SIZE + 1}): ${syncErr.message}` 
        }, { status: 500 });
      }
      
      totalSynced += batch.length;
    }

    return NextResponse.json({
      ok: true,
      message: `Endurreiknaði og samstillti ${totalSynced} spár fyrir alla meðlimi með sama username`,
      predictionsSynced: totalSynced,
      totalPredictions: allPredictions?.length || 0,
      totalMembers: allMembers?.length || 0,
      batchesProcessed: Math.ceil(predictionsToSync.length / BATCH_SIZE),
    });
  } catch (error: any) {
    console.error("Unexpected error in recalculate-predictions:", error);
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
