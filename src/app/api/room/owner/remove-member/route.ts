import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { getSession } from "@/lib/session";

type Body = {
  ownerPassword: string;
  memberId: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const memberId = (body.memberId || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Lykilorð stjórnanda vantar" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "ID meðlims vantar" }, { status: 400 });

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
    .select("id, is_owner")
    .eq("id", memberId)
    .eq("room_id", session.roomId)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Meðlimur fannst ekki" }, { status: 404 });

  // Ekki hægt að fjarlægja owner sjálfan
  if (member.is_owner) return NextResponse.json({ error: "Ekki hægt að fjarlægja stjórnanda" }, { status: 400 });

  // Fjarlægja member (cascade eyðir predictions og bonus answers)
  const { error: deleteErr } = await supabaseServer
    .from("room_members")
    .delete()
    .eq("id", memberId)
    .eq("room_id", session.roomId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Meðlimur hefur verið fjarlægður" });
}

