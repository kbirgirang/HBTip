import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { setSession } from "@/lib/session";

type Body = {
  roomCode: string;
  joinPassword: string;
  username: string;
  password: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  if (!roomCode) return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "Join password is required" }, { status: 400 });
  if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

  // Sækja room með join_password_hash
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // Athuga join password
  const joinOk = await verifyPassword(room.join_password_hash, joinPassword);
  if (!joinOk) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  // Sækja member með username
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, password_hash, is_owner")
    .eq("room_id", room.id)
    .ilike("username", username)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });

  // Athuga password
  const ok = await verifyPassword(member.password_hash, password);
  if (!ok) return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: member.is_owner ? "owner" : "player",
  });

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}

