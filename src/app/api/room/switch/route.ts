import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession, setSession } from "@/lib/session";

type Body = {
  roomCode: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  const body = (await req.json()) as Body;
  const targetRoomCode = (body.roomCode || "").trim();

  if (!targetRoomCode) return NextResponse.json({ error: "Room code vantar" }, { status: 400 });

  // Sækja username fyrir núverandi member
  const { data: currentMember, error: memErr } = await supabaseServer
    .from("room_members")
    .select("username")
    .eq("id", session.memberId)
    .single();

  if (memErr || !currentMember) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  // Sækja target room
  const { data: targetRoom, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code")
    .ilike("room_code", targetRoomCode)
    .single();

  if (rErr || !targetRoom) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Sækja member í target room með sama username
  const { data: targetMember, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, is_owner")
    .eq("room_id", targetRoom.id)
    .ilike("username", currentMember.username)
    .single();

  if (mErr || !targetMember) return NextResponse.json({ error: "Notandi er ekki í þessari deild" }, { status: 404 });

  // Uppfæra session
  await setSession({
    roomId: targetRoom.id,
    memberId: targetMember.id,
    roomCode: targetRoom.room_code,
    role: targetMember.is_owner ? "owner" : "player",
  });

  return NextResponse.json({ ok: true, roomCode: targetRoom.room_code });
}

