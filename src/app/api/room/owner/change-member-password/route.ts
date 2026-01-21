import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/passwords";

type Body = {
  memberId: string;
  newPassword: string;
};

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    const memberId = (body.memberId || "").trim();
    const newPassword = (body.newPassword || "").trim();

    if (!memberId) {
      return NextResponse.json({ error: "memberId vantar" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Nýtt lykilorð þarf að vera amk 6 stafir" }, { status: 400 });
    }

    // Sækja room og athuga að notandi sé owner
    const { data: room, error: rErr } = await supabaseServer
      .from("rooms")
      .select("id")
      .eq("id", session.roomId)
      .single();

    if (rErr || !room) {
      return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });
    }

    // Sækja owner member og athuga að hann sé owner
    const { data: owner, error: oErr } = await supabaseServer
      .from("room_members")
      .select("id, is_owner")
      .eq("id", session.memberId)
      .eq("room_id", room.id)
      .single();

    if (oErr || !owner) {
      return NextResponse.json({ error: "Stjórnandi fannst ekki" }, { status: 404 });
    }

    if (!owner.is_owner) {
      return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });
    }

    // Sækja member sem á að breyta
    const { data: member, error: mErr } = await supabaseServer
      .from("room_members")
      .select("id, is_owner")
      .eq("id", memberId)
      .eq("room_id", room.id)
      .single();

    if (mErr || !member) {
      return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });
    }

    // Ekki leyfa að breyta lykilorði hjá öðrum owner
    if (member.is_owner && member.id !== session.memberId) {
      return NextResponse.json({ error: "Ekki hægt að breyta lykilorði hjá öðrum stjórnanda" }, { status: 403 });
    }

    // Hasha nýtt password og uppfæra
    const newPasswordHash = await hashPassword(newPassword);

    const { error: updateErr } = await supabaseServer
      .from("room_members")
      .update({ password_hash: newPasswordHash })
      .eq("id", memberId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}

