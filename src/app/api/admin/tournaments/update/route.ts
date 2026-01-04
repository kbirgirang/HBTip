import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  tournamentId: string;
  name: string;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const tournamentId = body.tournamentId;
  const name = (body.name || "").trim();

  if (!tournamentId) return NextResponse.json({ error: "Tournament ID vantar" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nafn vantar" }, { status: 400 });
  if (name.length < 3) return NextResponse.json({ error: "Nafn þarf að vera amk 3 stafir" }, { status: 400 });

  const { data: tournament, error } = await supabaseServer
    .from("tournaments")
    .update({ name })
    .eq("id", tournamentId)
    .select("id, slug, name, is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournament });
}

