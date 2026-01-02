import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  // Sækja room til að fá tournament_id
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("tournament_id")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Sækja allar leikmenn fyrir tournament
  const { data: players, error: pErr } = await supabaseServer
    .from("players")
    .select("id, full_name, team, is_active")
    .eq("tournament_id", room.tournament_id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ players: players || [] });
}

