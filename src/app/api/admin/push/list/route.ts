import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const authError = await requireAdminSession();
  if (authError) return authError;

  // Sækja allar push subscriptions með member upplýsingum
  const { data: subscriptions, error } = await supabaseServer
    .from("push_subscriptions")
    .select(`
      id,
      member_id,
      created_at,
      room_members!inner (
        id,
        username,
        display_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten results
  const users = (subscriptions || []).map((sub: any) => ({
    subscriptionId: sub.id,
    memberId: sub.member_id,
    username: sub.room_members?.username || "Unknown",
    displayName: sub.room_members?.display_name || "Unknown",
    subscribedAt: sub.created_at,
  }));

  return NextResponse.json({ users });
}
