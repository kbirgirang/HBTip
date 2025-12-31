import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  adminPassword: string;
  pointsPerCorrect1x2: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminPassword = (body.adminPassword || "").trim();
  const points = body.pointsPerCorrect1x2;

  if (!adminPassword) return NextResponse.json({ error: "Admin password vantar." }, { status: 400 });
  if (!Number.isFinite(points) || points <= 0 || points > 100) {
    return NextResponse.json({ error: "pointsPerCorrect1x2 þarf að vera 1–100." }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: "ADMIN_PASSWORD is not set in .env.local" }, { status: 500 });
  if (adminPassword !== expected) return NextResponse.json({ error: "Wrong admin password" }, { status: 401 });

  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !tournament) return NextResponse.json({ error: "Active tournament not found" }, { status: 500 });

  const { data, error } = await supabaseServer
    .from("admin_settings")
    .upsert(
      { tournament_id: tournament.id, points_per_correct_1x2: Math.trunc(points) },
      { onConflict: "tournament_id" }
    )
    .select("points_per_correct_1x2")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pointsPerCorrect1x2: data.points_per_correct_1x2 });
}
