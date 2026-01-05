import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { setSession } from "@/lib/session";

type Body = {
  username: string;
  password: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  if (!username) return NextResponse.json({ error: "Notandanafn er krafist" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Lykilorð er krafist" }, { status: 400 });

  // Sækja allar deildir sem notandi er í með sama username
  const { data: allMembers, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id, password_hash, is_owner, display_name")
    .ilike("username", username);

  if (mErr) return NextResponse.json({ error: "Villa við að sækja notanda" }, { status: 500 });

  if (!allMembers || allMembers.length === 0) {
    return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });
  }

  // Athuga password fyrir hvern member
  const validMembers: Array<{
    id: string;
    room_id: string;
    is_owner: boolean;
    display_name: string;
  }> = [];

  for (const member of allMembers) {
    const passwordOk = await verifyPassword(member.password_hash, password);
    if (passwordOk) {
      validMembers.push({
        id: member.id,
        room_id: member.room_id,
        is_owner: member.is_owner,
        display_name: member.display_name,
      });
    }
  }

  if (validMembers.length === 0) {
    return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });
  }

  // Sækja room upplýsingar fyrir allar gildar deildir
  const roomIds = validMembers.map((m) => m.room_id);
  const { data: rooms, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name")
    .in("id", roomIds);

  if (rErr || !rooms) {
    return NextResponse.json({ error: "Villa við að sækja deildir" }, { status: 500 });
  }

  // Sameina member og room upplýsingar
  const roomsWithInfo = validMembers
    .map((member) => {
      const room = rooms.find((r) => r.id === member.room_id);
      if (!room) return null;
      return {
        roomId: member.room_id,
        roomCode: room.room_code,
        roomName: room.room_name,
        memberId: member.id,
        isOwner: member.is_owner,
        displayName: member.display_name,
      };
    })
    .filter((r) => r !== null) as Array<{
    roomId: string;
    roomCode: string;
    roomName: string;
    memberId: string;
    isOwner: boolean;
    displayName: string;
  }>;

  if (roomsWithInfo.length === 0) {
    return NextResponse.json({ error: "Engar deildir fundust" }, { status: 404 });
  }

  // Skrá notanda beint inn á fyrstu deildina sem hann er í
  const room = roomsWithInfo[0];
  await setSession({
    roomId: room.roomId,
    memberId: room.memberId,
    roomCode: room.roomCode,
    role: room.isOwner ? "owner" : "player",
  });
  return NextResponse.json({ ok: true, roomCode: room.roomCode });
}

