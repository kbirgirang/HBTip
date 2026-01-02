import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  questionId: string;
  correctNumber?: number | null;
  correctChoice?: string | null;
};

export async function POST(req: Request) {
  // Check admin session
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;

  if (!body.questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const { data: q, error: qErr } = await supabaseServer
    .from("bonus_questions")
    .select("id, type")
    .eq("id", body.questionId)
    .single();

  if (qErr || !q) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  if (q.type === "number") {
    if (body.correctNumber === undefined || body.correctNumber === null || Number.isNaN(Number(body.correctNumber))) {
      return NextResponse.json({ error: "correctNumber required" }, { status: 400 });
    }
    const { error } = await supabaseServer
      .from("bonus_questions")
      .update({ correct_number: Number(body.correctNumber) })
      .eq("id", q.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // type=choice
  if (q.type === "choice") {
    if (!body.correctChoice || typeof body.correctChoice !== "string") {
      return NextResponse.json({ error: "correctChoice required" }, { status: 400 });
    }
    const { error } = await supabaseServer
      .from("bonus_questions")
      .update({ correct_choice: body.correctChoice.trim() })
      .eq("id", q.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid bonus type" }, { status: 400 });
}
