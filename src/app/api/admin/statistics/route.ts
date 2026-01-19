import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    // Sækja allar username úr room_members og telja einstaka
    const { data: allMembers, error: memberErr } = await supabaseServer
      .from("room_members")
      .select("username");

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    // Telja einstaka username (case-insensitive)
    const uniqueUsernames = new Set(
      (allMembers || []).map((m: any) => (m.username || "").toLowerCase().trim()).filter((u: string) => u.length > 0)
    );
    const userCount = uniqueUsernames.size;

    // Count total rooms (divisions)
    const { count: roomCount, error: roomErr } = await supabaseServer
      .from("rooms")
      .select("*", { count: "exact", head: true });

    if (roomErr) {
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    return NextResponse.json({
      totalUsers: userCount,
      totalRooms: roomCount || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
