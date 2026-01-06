import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  tournamentSlug?: string;
  tournamentId?: string;
};

export async function POST(req: Request) {
  try {
    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const body = (await req.json()) as Body;
    const tournamentSlug = body.tournamentSlug;
    const tournamentId = body.tournamentId;

    if (!tournamentSlug && !tournamentId) {
      return NextResponse.json({ error: "tournamentSlug eða tournamentId vantar." }, { status: 400 });
    }

    // Sækja tournament
    let tournament;
    if (tournamentId) {
      const { data: t, error: tErr } = await supabaseServer
        .from("tournaments")
        .select("id")
        .eq("id", tournamentId)
        .single();

      if (tErr || !t) {
        return NextResponse.json({ error: "Keppni fannst ekki" }, { status: 404 });
      }
      tournament = t;
    } else {
      const { data: t, error: tErr } = await supabaseServer
        .from("tournaments")
        .select("id")
        .eq("slug", tournamentSlug)
        .single();

      if (tErr || !t) {
        return NextResponse.json({ error: "Keppni fannst ekki" }, { status: 404 });
      }
      tournament = t;
    }

    // Sækja fjölda leikja áður en eytt er
    const { count, error: countErr } = await supabaseServer
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    // Eyða öllum leikjum úr keppni
    // Ath: cascade delete á predictions og bonus_questions ef FK er með on delete cascade
    const { error: dErr } = await supabaseServer
      .from("matches")
      .delete()
      .eq("tournament_id", tournament.id);

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedCount: count ?? 0 });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}

