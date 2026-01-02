import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { setSession } from "@/lib/session";

type Body = {
  roomCode: string;
  joinPassword: string;
  username: string;
  password: string;
  displayName: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const roomCode = (body.roomCode || "").trim();
  const joinPassword = (body.joinPassword || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();
  const displayName = (body.displayName || "").trim();

  if (!roomCode) return NextResponse.json({ error: "Númer deildar er krafist" }, { status: 400 });
  if (!joinPassword) return NextResponse.json({ error: "Join password er krafist" }, { status: 400 });
  if (username.length < 3) return NextResponse.json({ error: "Notandanafn þarf að vera amk 3 stafir" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Lykilorð þarf að vera amk 6 stafir" }, { status: 400 });
  if (displayName.length < 2) return NextResponse.json({ error: "Nafn þarf að vera amk 2 stafir" }, { status: 400 });

  // Athuga room og join password
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, join_password_hash")
    .ilike("room_code", roomCode)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  const ok = await verifyPassword(room.join_password_hash, joinPassword);
  if (!ok) return NextResponse.json({ error: "Wrong join password" }, { status: 401 });

  // Athuga hvort username sé þegar til í þessum room
  const { data: existing } = await supabaseServer
    .from("room_members")
    .select("id, password_hash, is_owner")
    .eq("room_id", room.id)
    .ilike("username", username)
    .maybeSingle();

  if (existing) {
    // Ef notandi er þegar í þessari deild, athuga password og skrá hann inn
    const passwordOk = await verifyPassword(existing.password_hash, password);
    if (!passwordOk) {
      return NextResponse.json({ error: "Rangt lykilorð fyrir þennan notanda í þessari deild" }, { status: 401 });
    }
    
    await setSession({
      roomId: room.id,
      memberId: existing.id,
      roomCode: room.room_code,
      role: existing.is_owner ? "owner" : "player",
    });
    return NextResponse.json({ ok: true, roomCode: room.room_code, alreadyMember: true });
  }

  // Búa til nýjan member með username og password
  // Athuga fyrst hvort notandi sé í annarri deild með sama username
  const { data: otherRoomMember } = await supabaseServer
    .from("room_members")
    .select("id, room_id")
    .ilike("username", username)
    .maybeSingle();

  // Ef notandi er í annarri deild, leyfum honum samt að joina nýja deild
  // (hann verður búinn til sem nýr member í nýju deildinni)
  const passwordHash = await hashPassword(password);

  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .insert({
      room_id: room.id,
      username,
      password_hash: passwordHash,
      display_name: displayName,
      is_owner: false,
    })
    .select("id")
    .single();

  if (mErr || !member) {
    // Ef unique constraint error, þá er notandi þegar í þessari deild
    if (mErr?.code === "23505" || mErr?.message?.includes("unique")) {
      // Notandi er þegar í þessari deild, prófum að skrá hann inn
      const { data: existingMember } = await supabaseServer
        .from("room_members")
        .select("id, password_hash, is_owner")
        .eq("room_id", room.id)
        .ilike("username", username)
        .single();
      
      if (existingMember) {
        const passwordOk = await verifyPassword(existingMember.password_hash, password);
        if (passwordOk) {
          await setSession({
            roomId: room.id,
            memberId: existingMember.id,
            roomCode: room.room_code,
            role: existingMember.is_owner ? "owner" : "player",
          });
          return NextResponse.json({ ok: true, roomCode: room.room_code, alreadyMember: true });
        } else {
          return NextResponse.json({ error: "Rangt lykilorð fyrir þennan notanda í þessari deild" }, { status: 401 });
        }
      }
    }
    return NextResponse.json({ error: mErr?.message || "Ekki tókst að skrá sig" }, { status: 500 });
  }

  await setSession({
    roomId: room.id,
    memberId: member.id,
    roomCode: room.room_code,
    role: "player",
  });

  return NextResponse.json({ ok: true, roomCode: room.room_code });
}

