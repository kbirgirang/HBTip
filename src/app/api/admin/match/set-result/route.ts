import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  adminPassword: string;
  matchId: string;
  result: "1" | "X" | "2" | null; // null = clear result
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 500 });
  }
  if (body.adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!body.matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  // validate result
  if (body.result !== null && body.result !== "1" && body.result !== "X" && body.result !== "2") {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  const finishedAt = body.result ? new Date().toISOString() : null;

  const { error } = await supabaseServer
    .from("matches")
    .update({
      result: body.result,
      finished_at: finishedAt,
    })
    .eq("id", body.matchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
