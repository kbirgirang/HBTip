import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  bonusId: string;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const bonusId = (body.bonusId || "").trim();

  if (!bonusId) return NextResponse.json({ error: "Bonus ID vantar" }, { status: 400 });

  // Eyða bonus question
  const { error: deleteErr } = await supabaseServer.from("bonus_questions").delete().eq("id", bonusId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

