import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword, hashPassword } from "@/lib/passwords";
import { getSession } from "@/lib/session";

type Body = {
  ownerPassword: string;
  newJoinPassword: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const newJoinPassword = (body.newJoinPassword || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Lykilorð stjórnanda vantar" }, { status: 400 });
  if (newJoinPassword.length < 6) return NextResponse.json({ error: "Nýtt join password þarf að vera amk 6 stafir" }, { status: 400 });

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

  // Uppfæra join password
  const newJoinPasswordHash = await hashPassword(newJoinPassword);

  const { error: updateErr } = await supabaseServer
    .from("rooms")
    .update({ join_password_hash: newJoinPasswordHash })
    .eq("id", session.roomId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Join password hefur verið breytt" });
}

