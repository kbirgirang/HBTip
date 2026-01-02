import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type BonusType = "number" | "choice" | "player";

function normalizeType(v: any): BonusType | null {
  const s = String(v || "").toLowerCase().trim();
  if (s === "number" || s === "choice" || s === "player") return s;
  return null;
}

function parseOptions(text: any): string[] {
  const raw = String(text || "");
  const arr = raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // unique while keeping order
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of arr) {
    const key = a.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Check admin session
    const authError = await requireAdminSession();
    if (authError) return authError;

    const matchId = String(body?.matchId || "");
    const title = String(body?.title || "").trim();
    const points = Number(body?.points ?? 5);
    const type = normalizeType(body?.type);

    // Fyrir choice - taka við bæði options (array) og optionsText (string)
    const optionsArray = body?.options; // array sem frontend sendir
    const optionsText = body?.optionsText; // string (gamla leiðin, ef einhver notar)

    // Correct fields (valfrjálst)
    const correctNumber = body?.correctNumber != null ? Number(body.correctNumber) : null;
    const correctChoice = body?.correctChoice ? String(body.correctChoice).trim() : null;
    const correctPlayerName = body?.correctPlayerName ? String(body.correctPlayerName).trim() : null;
    const playerOptions = body?.playerOptions;

    if (!matchId) {
      return NextResponse.json({ error: "matchId vantar." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Bónus spurning vantar." }, { status: 400 });
    }
    if (!Number.isFinite(points) || points < 0) {
      return NextResponse.json({ error: "Stig þurfa að vera 0 eða hærra." }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: "Type þarf að vera 'number', 'choice' eða 'player'." }, { status: 400 });
    }

    // Sækjum match til að fá tournament_id + starts_at
    const { data: match, error: mErr } = await supabaseServer
      .from("matches")
      .select("id, tournament_id, starts_at")
      .eq("id", matchId)
      .single();

    if (mErr || !match) {
      return NextResponse.json({ error: "Leikur fannst ekki." }, { status: 404 });
    }

    // Lokar sjálfkrafa á match start
    const closesAt = match.starts_at;

    let choiceOptions: string[] | null = null;

    if (type === "choice") {
      let opts: string[] = [];
      
      // Ef options er array (nýja leiðin frá frontend)
      if (Array.isArray(optionsArray) && optionsArray.length > 0) {
        opts = optionsArray
          .map((x: any) => String(x || "").trim())
          .filter(Boolean);
      } 
      // Ef optionsText er string (gamla leiðin)
      else if (optionsText) {
        opts = parseOptions(optionsText);
      }
      
      if (opts.length < 2 || opts.length > 6) {
        return NextResponse.json(
          { error: "Valmöguleikar þurfa að vera 2–6 línur (1 per línu)." },
          { status: 400 }
        );
      }
      choiceOptions = opts;
    }

    // Validate correct fields based on type
    if (type === "number" && correctNumber != null && !Number.isFinite(correctNumber)) {
      return NextResponse.json({ error: "correctNumber er ógild tala." }, { status: 400 });
    }
    if (type === "choice" && correctChoice && choiceOptions && !choiceOptions.includes(correctChoice)) {
      return NextResponse.json({ error: "correctChoice er ekki í valmöguleikum." }, { status: 400 });
    }
    let playerOptionsJson: any = null;
    if (type === "player") {
      if (!playerOptions || !Array.isArray(playerOptions) || playerOptions.length === 0) {
        return NextResponse.json({ error: "playerOptions er krafist fyrir player type." }, { status: 400 });
      }
      // Validate player options structure
      for (const p of playerOptions) {
        if (!p || typeof p.name !== "string" || !p.name.trim()) {
          return NextResponse.json({ error: "Hver leikmaður verður að hafa 'name' field." }, { status: 400 });
        }
      }
      playerOptionsJson = playerOptions;
      
      if (!correctPlayerName) {
        return NextResponse.json({ error: "correctPlayerName er krafist fyrir player type." }, { status: 400 });
      }
      // Verify correct player name is in options
      const playerNames = playerOptions.map((p: any) => p.name.trim().toLowerCase());
      if (!playerNames.includes(correctPlayerName.toLowerCase())) {
        return NextResponse.json({ error: "correctPlayerName verður að vera í playerOptions listanum." }, { status: 400 });
      }
    }

    // Upsert per match (1 bónus per match)
    const payload: any = {
      tournament_id: match.tournament_id,
      match_id: matchId,
      title,
      type,
      points,
      closes_at: closesAt,

      // Correct fields (set úr body eða null)
      correct_number: type === "number" ? correctNumber : null,
      correct_choice: type === "choice" ? correctChoice : (type === "player" ? correctPlayerName : null), // For player type, store correct name in correct_choice
      correct_player_id: null, // Not used anymore for player type with JSON options

      // Choice
      choice_options: choiceOptions,
      
      // Player options (JSON) - stores array of {name, team?}
      player_options: type === "player" ? playerOptionsJson : null,
    };

    const { data: saved, error: upErr } = await supabaseServer
      .from("bonus_questions")
      .upsert(payload, { onConflict: "match_id" })
      .select("id, match_id, title, type, points, closes_at")
      .single();

    if (upErr) {
      // Check if it's the enum error
      if (upErr.message?.includes("invalid input value for enum bonus_type") || upErr.message?.includes("player")) {
        return NextResponse.json({ 
          error: `Villa: 'player' er ekki í bonus_type enum. Keyrðu MIGRATION_add_player_bonus_type.sql í Supabase SQL Editor. Upprunaleg villa: ${upErr.message}` 
        }, { status: 500 });
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, bonus: saved });
  } catch (e) {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}
