import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPassword } from "@/lib/passwords";
import { makeRoomCode } from "@/lib/roomCode";
import { setSession } from "@/lib/session";

type Body = {
  roomName: string;
  joinPassword: string;
  ownerPassword?: string;
  ownerUsername: string;
  ownerPassword_user: string;
  displayName: string;
};

function generateOwnerPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomName = (body.roomName || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const ownerUsername = (body.ownerUsername || "").trim().toLowerCase();
  const ownerPassword_user = (body.ownerPassword_user || "").trim();
  const displayName = (body.displayName || "").trim();
  const ownerPassword = (body.ownerPassword || "").trim() || generateOwnerPassword();

  if (roomName.length < 2) {
    return NextResponse.json({ error: "roomName is required" }, { status: 400 });
  }
  if (ownerUsername.length < 3) {
    return NextResponse.json({ error: "Owner username þarf að vera amk 3 stafir" }, { status: 400 });
  }
  if (ownerPassword_user.length < 6) {
    return NextResponse.json({ error: "Owner password þarf að vera amk 6 stafir" }, { status: 400 });
  }
  if (displayName.length < 2) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }
  if (joinPassword.length < 6) {
    return NextResponse.json({ error: "joinPassword must be at least 6 characters" }, { status: 400 });
  }

  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("slug", "mens-ehf-euro-2026")
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 500 });
  }

  let roomCode = makeRoomCode(roomName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabaseServer
      .from("rooms")
      .select("id")
      .ilike("room_code", roomCode)
      .maybeSingle();

    if (!existing) break;
    roomCode = makeRoomCode(roomName);
  }

  const ownerHash = await hashPassword(ownerPassword);
  const joinHash = await hashPassword(joinPassword);

  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .insert({
      tournament_id: tournament.id,
      room_code: roomCode,
      room_name: roomName,
      owner_password_hash: ownerHash,
      join_password_hash: joinHash,
    })
    .select("id, room_code, room_name")
    .single();

  if (rErr || !room) {
    return NextResponse.json({ error: rErr?.message || "Failed to create room" }, { status: 500 });
  }

  const ownerPasswordHash = await hashPassword(ownerPassword_user);

  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .insert({
      room_id: room.id,
      username: ownerUsername,
      password_hash: ownerPasswordHash,
      display_name: displayName,
      is_owner: true,
    })
    .select("id")
    .single();

  if (mErr || !member) {
    return NextResponse.json({ error: mErr?.message || "Failed to create owner member" }, { status: 500 });
  }

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: "owner",
  });

  return NextResponse.json({
    roomCode: room.room_code,
    roomName: room.room_name,
    ownerPassword,
  });
}
