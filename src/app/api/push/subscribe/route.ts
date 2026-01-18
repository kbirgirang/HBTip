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

  const { error } = await supabaseServer
    .from("push_subscriptions")
    .upsert(
      {
        member_id: session.memberId,
        subscription: subscription,
      },
      {
        onConflict: "member_id",
      }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
