// src/app/api/admin/match/set-result/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  adminPassword?: string;
  matchId?: string;
  result?: "1" | "X" | "2" | null; // null = clear result
};

function isValidResult(v: any): v is "1" | "X" | "2" | null {
  return v === null || v === "1" || v === "X" || v === "2";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 500 });
    }

    if (!body.adminPassword || body.adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body.matchId || typeof body.matchId !== "string") {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    if (!("result" in body)) {
      return NextResponse.json({ error: "result required (can be null)" }, { status: 400 });
    }

    if (!isValidResult(body.result)) {
      return NextResponse.json({ error: "Invalid result" }, { status: 400 });
    }

    // finished_at: set when result is set, cleared when result is cleared
    const finishedAt = body.result ? new Date().toISOString() : null;

    const { error } = await supabaseServer
      .from("matches")
      .update({
        result: body.result,
        finished_at: finishedAt,
      })
      .eq("id", body.matchId);

    if (error) {
      console.error("set-result DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("set-result unexpected error:", e);
    return NextResponse.json({ error: "Óvænt villa" }, { status: 500 });
  }
}
