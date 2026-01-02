import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { getSession } from "@/lib/session";

type Body = {
  ownerPassword: string;
  memberId: string;
  newDisplayName: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const memberId = (body.memberId || "").trim();
  const newDisplayName = (body.newDisplayName || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Lykilorð stjórnanda vantar" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "ID meðlims vantar" }, { status: 400 });
  if (newDisplayName.length < 2) return NextResponse.json({ error: "Nafn þarf að vera amk 2 stafir" }, { status: 400 });

  // Sækja room
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Sækja owner member og athuga password
  const { data: owner, error: oErr } = await supabaseServer
    .from("room_members")
    .select("id, password_hash, is_owner")
    .eq("id", session.memberId)
    .eq("room_id", room.id)
    .single();

  if (oErr || !owner) return NextResponse.json({ error: "Stjórnandi fannst ekki" }, { status: 404 });
  if (!owner.is_owner) return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  // Athuga owner password (password frá room_members)
  const ok = await verifyPassword(owner.password_hash, ownerPassword);
  if (!ok) return NextResponse.json({ error: "Rangt lykilorð stjórnanda" }, { status: 401 });

  // Athuga hvort member sé í sömu room
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id")
    .eq("id", memberId)
    .eq("room_id", session.roomId)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  // Uppfæra display name
  const { error: updateErr } = await supabaseServer
    .from("room_members")
    .update({ display_name: newDisplayName })
    .eq("id", memberId)
    .eq("room_id", session.roomId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Nafn hefur verið breytt" });
}

