import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.memberId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const subscription = body.subscription;

  if (!subscription) {
    return NextResponse.json({ error: "Subscription required" }, { status: 400 });
  }

      // Debug: Log subscription info
      const endpoint = subscription?.endpoint || "unknown";
      const isIOS = 
        endpoint.includes("push.apple.com") || 
        endpoint.includes("safari") ||
        endpoint.includes("apns");
      console.log(`Saving push subscription for member ${session.memberId}:`, {
        type: isIOS ? "iOS/Safari" : "Other",
        endpoint: endpoint.substring(0, 80),
      });

      const { data, error } = await supabaseServer
        .from("push_subscriptions")
        .upsert(
          {
            member_id: session.memberId,
            subscription: subscription,
          },
          {
            onConflict: "member_id",
          }
        )
        .select();

      if (error) {
        console.error("Failed to save push subscription:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`Push subscription saved successfully for member ${session.memberId}`);
      return NextResponse.json({ 
        ok: true, 
        type: isIOS ? "iOS/Safari" : "Other",
        endpoint: endpoint.substring(0, 60),
      });
}
