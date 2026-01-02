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
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Not owner" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const memberId = (body.memberId || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Owner password vantar" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "memberId vantar" }, { status: 400 });

  // Sækja room með owner_password_hash
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, owner_password_hash")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Deild fannst ekki" }, { status: 404 });

  // Athuga owner password
  const ok = await verifyPassword(room.owner_password_hash, ownerPassword);
  if (!ok) return NextResponse.json({ error: "Wrong owner password" }, { status: 401 });

  // Athuga hvort member sé í sömu room
  const { data: member, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, is_owner")
    .eq("id", memberId)
    .eq("room_id", session.roomId)
    .single();

  if (mErr || !member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Ekki hægt að fjarlægja owner sjálfan
  if (member.is_owner) return NextResponse.json({ error: "Ekki hægt að fjarlægja owner" }, { status: 400 });

  // Fjarlægja member (cascade eyðir predictions og bonus answers)
  const { error: deleteErr } = await supabaseServer
    .from("room_members")
    .delete()
    .eq("id", memberId)
    .eq("room_id", session.roomId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Member hefur verið fjarlægður" });
}

