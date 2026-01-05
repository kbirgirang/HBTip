import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { setSession } from "@/lib/session";

type Body = {
  memberId: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const memberId = (body.memberId || "").trim();

  if (!memberId) return NextResponse.json({ error: "memberId er krafist" }, { status: 400 });

  // Sækja member og room upplýsingar
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id, is_owner")
    .eq("id", memberId)
    .single();

  if (mErr || !member) {
    return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });
  }

  // Sækja room upplýsingar
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code")
    .eq("id", member.room_id)
    .single();

  if (rErr || !room) {
    return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });
  }

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: member.is_owner ? "owner" : "player",
  });

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}

