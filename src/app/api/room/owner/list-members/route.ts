import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Not owner" }, { status: 403 });

  // Sækja allar members í room
  const { data: members, error: mErr } = await supabaseServer
    .from("room_members")
    .select("id, username, display_name, is_owner, created_at")
    .eq("room_id", session.roomId)
    .order("created_at", { ascending: true });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ members: members ?? [] });
}

