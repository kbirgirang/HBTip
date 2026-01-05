import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tournamentSlug = searchParams.get("tournamentSlug");

  let tournament;
  if (tournamentSlug) {
    // Sækja tournament með slug
    const { data: t, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("slug", tournamentSlug)
      .single();

    if (tErr || !t) {
      return NextResponse.json({ 
        pointsPerCorrect1x2: 1, 
        pointsPerCorrectX: null 
      });
    }
    tournament = t;
  } else {
    // Ef engin slug, nota active tournament (backward compatibility)
    const { data: t, error: tErr } = await supabaseServer
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tErr || !t) {
      return NextResponse.json({ 
        pointsPerCorrect1x2: 1, 
        pointsPerCorrectX: null 
      });
    }
    tournament = t;
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

