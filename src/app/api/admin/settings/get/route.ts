import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ 
      pointsPerCorrect1x2: 1, 
      pointsPerCorrectX: null 
    });
  }

  const { data: settings, error: settingsErr } = await supabaseServer
    .from("admin_settings")
    .select("points_per_correct_1x2, points_per_correct_x")
    .eq("tournament_id", tournament.id)
    .maybeSingle();

  return NextResponse.json({
    pointsPerCorrect1x2: settings?.points_per_correct_1x2 ?? 1,
    pointsPerCorrectX: settings?.points_per_correct_x ?? null,
  });
}

