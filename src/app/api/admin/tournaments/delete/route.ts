import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  tournamentId: string;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const tournamentId = body.tournamentId;

  if (!tournamentId) return NextResponse.json({ error: "Tournament ID vantar" }, { status: 400 });

  // Athuga hvort keppni sé með deildir eða leiki
  const { data: rooms } = await supabaseServer
    .from("rooms")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1);

  if (rooms && rooms.length > 0) {
    return NextResponse.json({ 
      error: "Ekki er hægt að eyða keppni sem er með deildir. Eyða þarf fyrst öllum deildum sem tengjast keppninni." 
    }, { status: 400 });
  }

  const { data: matches } = await supabaseServer
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1);

  if (matches && matches.length > 0) {
    return NextResponse.json({ 
      error: "Ekki er hægt að eyða keppni sem er með leiki. Eyða þarf fyrst öllum leikjum sem tengjast keppninni." 
    }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

