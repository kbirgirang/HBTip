import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const { data: tournaments, error } = await supabaseServer
    .from("tournaments")
    .select("id, slug, name, is_active, created_at, api_football_league_id, api_football_season, api_football_enabled")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournaments: tournaments || [] });
}

