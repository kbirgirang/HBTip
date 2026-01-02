import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  // Sækja active tournament
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ players: [] });
  }

  // Sækja allar leikmenn fyrir active tournament
  const { data: players, error: pErr } = await supabaseServer
    .from("players")
    .select("id, full_name, team, is_active")
    .eq("tournament_id", tournament.id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ players: players || [] });
}

