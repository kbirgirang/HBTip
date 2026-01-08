import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Body = {
  matchId: string;
  pick: "1" | "X" | "2";
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  if (!body.matchId || !body.pick) {
    return NextResponse.json({ error: "matchId og pick eru krafist" }, { status: 400 });
  }

  // Fetch match to check start time, result, and allow_draw
  const { data: match, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, starts_at, allow_draw, result")
    .eq("id", body.matchId)
    .single();

  if (mErr || !match) {
    return NextResponse.json({ error: "Leikur fannst ekki" }, { status: 404 });
  }

  // Cannot pick draw if not allowed
  if (body.pick === "X" && !match.allow_draw) {
    return NextResponse.json({ error: "Jafntefli er ekki leyft í þessum leik" }, { status: 400 });
  }

  // Lock check: match started OR result is set
  const started = new Date(match.starts_at).getTime() <= Date.now();
  const locked = started || match.result != null;

  if (locked) {
    return NextResponse.json({ error: "Leikur er lokaður. Ekki hægt að breyta spá." }, { status: 400 });
  }

  // ✅ Sækja allar deildir sem notandi er skráður í
  const { data: currentMember, error: memErr } = await supabaseServer
    .from("room_members")
    .select("username")
    .eq("id", session.memberId)
    .single();

  if (memErr || !currentMember) {
    return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });
  }

  // Sækja allar deildir sem notandi er í með sama username
  const { data: allMyMembers, error: allErr } = await supabaseServer
    .from("room_members")
    .select("id, room_id")
    .ilike("username", currentMember.username);

  if (allErr) {
    return NextResponse.json({ error: allErr.message }, { status: 500 });
  }

  // ✅ Vista spá fyrir ALLAR deildir sem notandi er í
  const predictionsToInsert = (allMyMembers ?? []).map((member: any) => ({
    room_id: member.room_id,
    member_id: member.id,
    match_id: body.matchId,
    pick: body.pick,
  }));

  if (predictionsToInsert.length === 0) {
    return NextResponse.json({ error: "Engar deildir fundust" }, { status: 400 });
  }

  // Upsert predictions fyrir allar deildir
  const { error: pErr } = await supabaseServer
    .from("predictions")
    .upsert(predictionsToInsert, { onConflict: "member_id,match_id" });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, roomsUpdated: predictionsToInsert.length });
}
