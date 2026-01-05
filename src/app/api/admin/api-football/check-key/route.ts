import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const apiKey = process.env.API_FOOTBALL_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "API_FOOTBALL_KEY er ekki sett í environment variables" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, hasKey: true });
}

