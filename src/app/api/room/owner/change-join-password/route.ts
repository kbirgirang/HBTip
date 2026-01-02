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
  if (!session) return NextResponse.json({ error: "Ekki skráður inn" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Ekki stjórnandi" }, { status: 403 });

  const body = (await req.json()) as Body;

  const ownerPassword = (body.ownerPassword || "").trim();
  const newJoinPassword = (body.newJoinPassword || "").trim();

  if (!ownerPassword) return NextResponse.json({ error: "Lykilorð stjórnanda vantar" }, { status: 400 });
  if (newJoinPassword.length < 6) return NextResponse.json({ error: "Nýtt join password þarf að vera amk 6 stafir" }, { status: 400 });

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
  if (!owner.password_hash) {
    return NextResponse.json({ error: "Password hash fannst ekki fyrir stjórnanda" }, { status: 500 });
  }
  
  const ok = await verifyPassword(owner.password_hash, ownerPassword);
  if (!ok) {
    return NextResponse.json({ error: "Rangt lykilorð stjórnanda. Athugaðu að þú notir sama lykilorð og þú notaðir til að skrá þig inn." }, { status: 401 });
  }

  // Uppfæra join password
  const newJoinPasswordHash = await hashPassword(newJoinPassword);

  const { error: updateErr } = await supabaseServer
    .from("rooms")
    .update({ join_password_hash: newJoinPasswordHash })
    .eq("id", session.roomId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: "Join password hefur verið breytt" });
}

