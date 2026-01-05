import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPassword } from "@/lib/passwords";
import { setUserSession } from "@/lib/session";

type Body = {
  username: string;
  password: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const username = (body.username || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  if (!username) return NextResponse.json({ error: "Notandanafn er krafist" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Lykilorð er krafist" }, { status: 400 });

  // Sækja fyrsta room_member með þetta username (notandinn getur verið í fleiri deildum)
  const { data: members, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, username, password_hash")
    .ilike("username", username);

  if (mErr || !members || members.length === 0) {
    return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });
  }

  // Prófa að finna notanda með rétt password
  let foundMember: { id: string; username: string } | null = null;
  
  for (const member of members) {
    const passwordOk = await verifyPassword(member.password_hash, password);
    if (passwordOk) {
      foundMember = { id: member.id, username: member.username };
      break;
    }
  }

  if (!foundMember) {
    return NextResponse.json({ error: "Rangt notandanafn eða lykilorð" }, { status: 401 });
  }

  // Setja user session (ekki room session)
  await setUserSession({
    username: foundMember.username,
    userId: foundMember.id,
    loggedInAt: Date.now(),
  });

  return NextResponse.json({ ok: true, username: foundMember.username });
}

