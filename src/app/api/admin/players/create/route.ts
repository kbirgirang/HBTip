import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  fullName: string;
  team?: string;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const fullName = (body.fullName || "").trim();
  const team = (body.team || "").trim() || null;

  if (!fullName) return NextResponse.json({ error: "Nafn leikmanns vantar" }, { status: 400 });

  // Sækja active tournament
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Active tournament fannst ekki" }, { status: 404 });
  }

  // Búa til nýjan leikmann
  const { data: player, error: pErr } = await supabaseServer
    .from("players")
    .insert({
      tournament_id: tournament.id,
      full_name: fullName,
      team: team,
      is_active: true,
    })
    .select("id, full_name, team")
    .single();

  if (pErr) {
    // Ef unique constraint error, þá er leikmaður þegar til
    if (pErr.code === "23505" || pErr.message?.includes("unique")) {
      return NextResponse.json({ error: "Leikmaður með þetta nafn er þegar til" }, { status: 400 });
    }
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({ player });
}

