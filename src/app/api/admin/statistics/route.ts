import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  try {
    // Count total users
    const { count: userCount, error: userErr } = await supabaseServer
      .from("users")
      .select("*", { count: "exact", head: true });

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    // Count total rooms (divisions)
    const { count: roomCount, error: roomErr } = await supabaseServer
      .from("rooms")
      .select("*", { count: "exact", head: true });

    if (roomErr) {
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    return NextResponse.json({
      totalUsers: userCount || 0,
      totalRooms: roomCount || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Villa kom upp" }, { status: 500 });
  }
}
