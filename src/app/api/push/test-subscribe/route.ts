import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.memberId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Sækja allar push subscriptions fyrir þennan notanda
  const { data: subscriptions, error } = await supabaseServer
    .from("push_subscriptions")
    .select("*")
    .eq("member_id", session.memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (subscriptions || []).map((sub: any) => {
    const endpoint = sub.subscription?.endpoint || "unknown";
    const isIOS = 
      endpoint.includes("push.apple.com") || 
      endpoint.includes("safari") ||
      endpoint.includes("apns");
    return {
      id: sub.id,
      memberId: sub.member_id,
      createdAt: sub.created_at,
      type: isIOS ? "iOS/Safari" : "Other",
      endpoint: endpoint.substring(0, 100),
    };
  });

  return NextResponse.json({ 
    memberId: session.memberId,
    subscriptions: result,
    count: result.length,
  });
}