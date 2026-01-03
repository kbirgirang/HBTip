import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Public endpoint - skilar lista yfir allar deildir (bara room_code og room_name)
// Notað fyrir dropdown lista á login/register síðu
export async function GET() {
  const { data: rooms, error: rErr } = await supabaseServer
    .from("rooms")
    .select("room_code, room_name")
    .order("room_name", { ascending: true });

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({ rooms: rooms || [] });
}

