import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";

type Body = {
  roomCode: string;
  joinPassword: string;
  displayName?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const displayName = (body.displayName || "").trim();

  if (!roomCode) return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "Join password is required" }, { status: 400 });

  // Sækja room og athuga join password
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const joinOk = await verifyPassword(room.join_password_hash, joinPassword);
  if (!joinOk) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  // Sækja members - ef displayName er gefið, leita eftir því
  let query = supabaseServer
    .from("room_members")
    .select("username, display_name")
    .eq("room_id", room.id);

  if (displayName) {
    query = query.ilike("display_name", displayName);
  }

  const { data: members, error: mErr } = await query;

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  if (!members || members.length === 0) {
    return NextResponse.json({ error: "No members found" }, { status: 404 });
  }

  // Returna username(s) - ekki password (það er hashað)
  return NextResponse.json({
    usernames: members.map((m) => ({
      username: m.username,
      displayName: m.display_name,
    })),
  });
}

