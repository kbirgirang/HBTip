import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword, hashPassword } from "@/lib/passwords";

type Body = {
  roomCode: string;
  joinPassword: string;
  username: string;
  newPassword: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const newPassword = (body.newPassword || "").trim();

  if (!roomCode) return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "Join password is required" }, { status: 400 });
  if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });
  if (newPassword.length < 6) return NextResponse.json({ error: "New password þarf að vera amk 6 stafir" }, { status: 400 });

  // Sækja room og athuga join password
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const joinOk = await verifyPassword(room.join_password_hash, joinPassword);
  if (!joinOk) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  // Sækja member
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .ilike("username", username)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Username not found" }, { status: 404 });

  // Uppfæra password
  const newPasswordHash = await hashPassword(newPassword);

  const { error: updateErr } = await supabaseServer
    .from("room_members")
    .update({ password_hash: newPasswordHash })
    .eq("id", member.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Password has been reset" });
}

