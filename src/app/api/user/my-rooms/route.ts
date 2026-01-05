import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserSession } from "@/lib/session";

export async function GET() {
  const userSession = await getUserSession();
  if (!userSession) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  // Sækja allar deildir sem notandi er í með sama username
  const { data: allMyMembers, error: allErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id, display_name, is_owner")
    .ilike("username", userSession.username);

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  // Sækja room upplýsingar fyrir allar deildir
  const roomIds = (allMyMembers ?? []).map((m: any) => m.room_id);
  
  if (roomIds.length === 0) {
    return NextResponse.json({ rooms: [] });
  }

  const { data: rooms, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name")
    .in("id", roomIds);

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // Sameina member og room upplýsingar
  const roomsWithInfo = (allMyMembers ?? [])
    .map((member: any) => {
      const room = (rooms ?? []).find((r: any) => r.id === member.room_id);
      if (!room) return null;
      return {
        roomId: member.room_id,
        roomCode: room.room_code,
        roomName: room.room_name,
        displayName: member.display_name,
        isOwner: member.is_owner,
        memberId: member.id,
      };
    })
    .filter((r: any) => r !== null);

  return NextResponse.json({ rooms: roomsWithInfo });
}

