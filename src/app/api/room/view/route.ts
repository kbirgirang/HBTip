import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

type Pick = "1" | "X" | "2";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // 1) Room + tournament
  const { data: room, error: rErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, room_name, tournament_id")
    .eq("id", session.roomId)
    .single();

  if (rErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // 2) Current member
  const { data: me, error: meErr } = await supabaseServer
    .from("room_members")
    .select("id, display_name, is_owner")
    .eq("id", session.memberId)
    .single();

  if (meErr || !me) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // 3) Matches
  const { data: matches, error: mErr } = await supabaseServer
    .from("matches")
    .select("id, match_no, stage, home_team, away_team, starts_at, allow_draw, result")
    .eq("tournament_id", room.tournament_id)
    .order("starts_at", { ascending: true });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  // 4) Bonus questions PER MATCH (1 per match)
  const { data: bonusQs, error: bErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, match_id, title, type, points, closes_at, correct_number, correct_player_id")
    .eq("tournament_id", room.tournament_id);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // 5) Settings
  const { data: settings } = await supabaseServer
    .from("admin_settings")
    .select("points_per_correct_1x2")
    .eq("tournament_id", room.tournament_id)
    .single();

  const pointsPer = settings?.points_per_correct_1x2 ?? 1;

  // 6) Members
  const { data: members, error: memErr } = await supabaseServer
    .from("room_members")
    .select("id, display_name")
    .eq("room_id", room.id);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  // 7) Predictions for room
  const { data: preds, error: pErr } = await supabaseServer
    .from("predictions")
    .select("member_id, match_id, pick")
    .eq("room_id", room.id);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // --- Lookup maps
  const matchById = new Map((matches ?? []).map((x) => [x.id, x]));
  const bonusByMatchId = new Map<string, any>();
  for (const q of bonusQs ?? []) {
    // 1 per match - ef eitthvað er tví-tekið þá vinnur síðasta (en unique index á að stoppa það)
    bonusByMatchId.set(q.match_id, q);
  }

  // --- My picks
  const myPicks = new Map<string, Pick>();
  for (const pr of preds ?? []) {
    if (pr.member_id === session.memberId) myPicks.set(pr.match_id, pr.pick as Pick);
  }

  // 8) Leaderboard (bara 1X2 núna)
  const leaderboard = (members ?? []).map((m) => {
    let correct1x2 = 0;
    let points = 0;

    for (const pr of preds ?? []) {
      if (pr.member_id !== m.id) continue;
      const match = matchById.get(pr.match_id);
      if (!match?.result) continue;
      if (pr.pick === match.result) {
        correct1x2 += 1;
        points += pointsPer;
      }
    }

    return { memberId: m.id, displayName: m.display_name, points, correct1x2 };
  });

  leaderboard.sort(
    (a, b) => b.points - a.points || b.correct1x2 - a.correct1x2 || a.displayName.localeCompare(b.displayName)
  );

  // 9) Return matches with myPick + bonus
  const matchesOut = (matches ?? []).map((m) => ({
    ...m,
    myPick: myPicks.get(m.id) ?? null,
    bonus: bonusByMatchId.get(m.id) ?? null,
  }));

  return NextResponse.json({
    room: { code: room.room_code, name: room.room_name },
    me,
    pointsPerCorrect1x2: pointsPer,
    matches: matchesOut,
    leaderboard,
  });
}
