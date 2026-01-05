import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { getUserSession } from "@/lib/session";

type Body = {
  roomCode: string;
  joinPassword: string;
  displayName: string;
};

export async function POST(req: Request) {
  const userSession = await getUserSession();
  if (!userSession) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });

  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const displayName = (body.displayName || "").trim();

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

  // Sækja password_hash úr einhverri deild sem notandinn er í
  const { data: existingMember } = await supabaseServer
    .from("room_members")
    .select("password_hash")
    .ilike("username", userSession.username)
    .limit(1)
    .single();

  if (!existingMember) {
    return NextResponse.json({ error: "Ekki tókst að finna notanda" }, { status: 500 });
  }

  // Athuga hvort notandi sé þegar í þessari deild
  const { data: alreadyMember } = await supabaseServer
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .ilike("username", userSession.username)
    .maybeSingle();

  if (alreadyMember) {
    return NextResponse.json({ error: "Þú ert þegar í þessari deild" }, { status: 400 });
  }

  // Búa til nýjan member með sama username og password
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .insert({
      room_id: room.id,
      username: userSession.username,
      password_hash: existingMember.password_hash,
      display_name: displayName,
      is_owner: false,
    })
    .select("id")
    .single();

  if (mErr || !member) {
    return NextResponse.json({ error: mErr?.message || "Ekki tókst að skrá sig í deild" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}
