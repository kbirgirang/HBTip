import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserSession } from "@/lib/session";

export async function GET() {
  const userSession = await getUserSession();
  if (!userSession) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  // Sækja fyrstu deild sem notandi er í
  const { data: firstMember, error: allErr } = await supabaseServer
    .from("room_members")
    .select("room_id")
    .ilike("username", userSession.username)
    .limit(1)
    .single();

  if (allErr || !firstMember) {
    return NextResponse.json({ roomCode: null });
  }

  // Sækja room code
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("room_code")
    .eq("id", firstMember.room_id)
    .single();

  if (rErr || !room) {
    return NextResponse.json({ roomCode: null });
  }

  return NextResponse.json({ roomCode: room.room_code });
}

