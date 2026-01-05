import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { setSession } from "@/lib/session";

type Body = {
  roomCode: string;
  joinPassword: string;
  displayName: string;
  pin?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const displayName = (body.displayName || "").trim();
  const pin = (body.pin || "").trim();

  if (!roomCode) return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "joinPassword is required" }, { status: 400 });
  if (displayName.length < 2) return NextResponse.json({ error: "displayName is required" }, { status: 400 });

  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  const ok = await verifyPassword(room.join_password_hash, joinPassword);
  if (!ok) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  const pinHash = pin ? await hashPassword(pin) : null;

  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .insert({
      room_id: room.id,
      display_name: displayName,
      is_owner: false,
      pin_hash: pinHash,
    })
    .select("id")
    .single();

  if (mErr || !member) {
    return NextResponse.json({ error: mErr?.message || "Ekki tókst að skrá sig í deild" }, { status: 400 });
  }

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: "player",
  });

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}
