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
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const memberId = (body.memberId || "").trim();
  const newDisplayName = (body.newDisplayName || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Lykilorð stjórnanda vantar" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "memberId vantar" }, { status: 400 });
  if (newDisplayName.length < 2) return NextResponse.json({ error: "Display name þarf að vera amk 2 stafir" }, { status: 400 });

  // Sækja room með owner_password_hash
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, owner_password_hash")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Athuga owner password
  const ok = await verifyPassword(room.owner_password_hash, ownerPassword);
  if (!ok) return NextResponse.json({ error: "Rangt lykilorð stjórnanda" }, { status: 401 });

  // Athuga hvort member sé í sömu room
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id")
    .eq("id", memberId)
    .eq("room_id", session.roomId)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Uppfæra display name
  const { error: updateErr } = await supabaseServer
    .from("room_members")
    .update({ display_name: newDisplayName })
    .eq("id", memberId)
    .eq("room_id", session.roomId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Display name hefur verið breytt" });
}

