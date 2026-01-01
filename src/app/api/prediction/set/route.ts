import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Body = {
  matchId: string;
  pick: "1" | "X" | "2";
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  if (!body.matchId || !body.pick) {
    return NextResponse.json({ error: "matchId and pick required" }, { status: 400 });
  }

  // Fetch match to check start time, result, and allow_draw
  const { data: match, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, starts_at, allow_draw, result")
    .eq("id", body.matchId)
    .single();

  if (mErr || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Cannot pick draw if not allowed
  if (body.pick === "X" && !match.allow_draw) {
    return NextResponse.json({ error: "Draw not allowed for this match" }, { status: 400 });
  }

  // Lock check: match started OR result is set
  const started = new Date(match.starts_at).getTime() <= Date.now();
  const locked = started || match.result != null;

  if (locked) {
    return NextResponse.json({ error: "Leikur er lokaður. Ekki hægt að breyta spá." }, { status: 400 });
  }

  // Upsert prediction
  const { error: pErr } = await supabaseServer
    .from("predictions")
    .upsert(
      {
        room_id: session.roomId,
        member_id: session.memberId,
        match_id: match.id,
        pick: body.pick,
      },
      { onConflict: "member_id,match_id" }
    );

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
