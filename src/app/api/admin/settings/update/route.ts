import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  pointsPerCorrect1x2: number;
  pointsPerCorrectX?: number | null;
};

export async function POST(req: Request) {
  // Check admin session
  const authError = await requireAdminSession();
  if (authError) return authError;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const points = body.pointsPerCorrect1x2;
  const pointsX = body.pointsPerCorrectX != null ? Number(body.pointsPerCorrectX) : null;

  if (!Number.isFinite(points) || points <= 0 || points > 100) {
    return NextResponse.json({ error: "pointsPerCorrect1x2 þarf að vera 1–100." }, { status: 400 });
  }
  if (pointsX != null && (!Number.isFinite(pointsX) || pointsX <= 0 || pointsX > 100)) {
    return NextResponse.json({ error: "pointsPerCorrectX þarf að vera 1–100 eða tómur." }, { status: 400 });
  }

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
      { 
        tournament_id: tournament.id, 
        points_per_correct_1x2: Math.trunc(points),
        points_per_correct_x: pointsX != null ? Math.trunc(pointsX) : null
      },
      { onConflict: "tournament_id" }
    )
    .select("points_per_correct_1x2, points_per_correct_x")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Debug: Log hvað er vistað
  console.log("[admin/settings/update] Tournament ID:", tournament.id);
  console.log("[admin/settings/update] Saved points:", {
    pointsPerCorrect1x2: data.points_per_correct_1x2,
    pointsPerCorrectX: data.points_per_correct_x
  });

  return NextResponse.json({ 
    ok: true, 
    pointsPerCorrect1x2: data.points_per_correct_1x2,
    pointsPerCorrectX: data.points_per_correct_x
  });
}
