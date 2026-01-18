import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import webpush from "web-push";

// VAPID keys úr environment variables með fallback
// Fallback keys - notaðir ef environment variables eru ekki aðgengilegir
const FALLBACK_VAPID_PUBLIC_KEY = "BFU2gUkANWpqw0yciW3WoX5fl6OWGjlHXk-e5t_tSaqwWBbt5_lvCX59m3jMLydkuLlU735Ci2_CkT6v0pDCQeU";
const FALLBACK_VAPID_PRIVATE_KEY = "EOOSFYMsthNfeX2YOK5tDo16SdjDejhxmPJPZOMqMtI";

const VAPID_PUBLIC_KEY = 
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
  process.env.VAPID_PUBLIC_KEY || 
  FALLBACK_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = 
  process.env.VAPID_PRIVATE_KEY || 
  FALLBACK_VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Setja upp VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  
  // Log ef fallback er notaður
  if (VAPID_PUBLIC_KEY === FALLBACK_VAPID_PUBLIC_KEY || VAPID_PRIVATE_KEY === FALLBACK_VAPID_PRIVATE_KEY) {
    console.warn("Using fallback VAPID keys - environment variables not found");
  }
}

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = await req.json();
  const { title, message, memberId, sendToAll } = body;

  if (!title || !message) {
    return NextResponse.json(
      { error: "Titill og skilaboð þurfa að vera til staðar" },
      { status: 400 }
    );
  }

  // VAPID keys eru alltaf til staðar (með fallback), svo þetta check er ekki lengur nauðsynlegt
  // En við geymum þetta fyrir öryggi
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "VAPID keys eru ekki settar upp. Setja þarf í .env.local eða Vercel environment variables" },
      { status: 500 }
    );
  }

  try {
    let subscriptions: any[] = [];

    if (sendToAll) {
      // Sækja allar subscriptions
      const { data, error } = await supabaseServer
        .from("push_subscriptions")
        .select("id, member_id, subscription");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      subscriptions = data || [];
    } else if (memberId) {
      // Sækja subscription fyrir einn notanda
      const { data, error } = await supabaseServer
        .from("push_subscriptions")
        .select("id, member_id, subscription")
        .eq("member_id", memberId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Push subscription fannst ekki" },
          { status: 404 }
        );
      }
      subscriptions = [data];
    } else {
      return NextResponse.json(
        { error: "memberId eða sendToAll þarf að vera til staðar" },
        { status: 400 }
      );
    }

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "Engar push subscriptions fundust" },
        { status: 404 }
      );
    }

    // Sendir push notification til allra subscriptions
    const payload = JSON.stringify({
      title,
      body: message,
      url: "/",
    });

    // Log subscriptions fyrir debugging
    console.log(`Sending push to ${subscriptions.length} subscriptions:`);
    const subscriptionInfo: any[] = [];
    subscriptions.forEach((sub, idx) => {
      const endpoint = sub.subscription?.endpoint || "unknown";
      const isIOS = endpoint.includes("push.apple.com") || endpoint.includes("safari");
      subscriptionInfo.push({
        memberId: sub.member_id,
        type: isIOS ? "iOS/Safari" : "Other",
        endpoint: endpoint.substring(0, 80),
      });
      console.log(`  ${idx + 1}. Member ${sub.member_id} - ${isIOS ? "iOS/Safari" : "Other"} - ${endpoint.substring(0, 60)}...`);
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub, index) =>
        webpush
          .sendNotification(sub.subscription, payload)
          .then(() => {
            const endpoint = sub.subscription?.endpoint || "unknown";
            const isIOS = endpoint.includes("push.apple.com") || endpoint.includes("safari");
            console.log(`✅ Push sent successfully to member ${sub.member_id} (${isIOS ? "iOS/Safari" : "Other"})`);
          })
          .catch((error) => {
            // Log details about failed push
            const endpoint = sub.subscription?.endpoint || "unknown";
            const isIOS = endpoint.includes("push.apple.com") || endpoint.includes("safari");
            console.error(`❌ Push failed for subscription ${index} (${isIOS ? "iOS/Safari" : "Other"}):`, {
              memberId: sub.member_id,
              endpoint: endpoint.substring(0, 80) + "...",
              errorCode: error.statusCode,
              errorMessage: error.message,
              errorBody: error.body,
            });
            throw error;
          })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Debug: Log failed subscriptions
    const failedDetails: any[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        const reason = (results[i] as PromiseRejectedResult).reason;
        const sub = subscriptions[i];
        failedDetails.push({
          memberId: sub.member_id,
          statusCode: reason?.statusCode,
          message: reason?.message,
          endpoint: sub.subscription?.endpoint?.substring(0, 50) + "...",
        });

        if (reason?.statusCode === 410 || reason?.statusCode === 404) {
          // Subscription er ógild, eyða henni
          try {
            await supabaseServer
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
            console.log(`Deleted invalid subscription for member ${sub.member_id}`);
          } catch {
            // Ignore delete errors
          }
        }
      }
    }

    // Log successful pushes
    if (successful > 0) {
      console.log(`Successfully sent ${successful} push notifications`);
    }
    if (failed > 0) {
      console.error(`Failed to send ${failed} push notifications:`, failedDetails);
    }

    // Greina iOS vs Other subscriptions
    const iosSubscriptions = subscriptionInfo.filter((s) => s.type === "iOS/Safari").length;
    const otherSubscriptions = subscriptionInfo.filter((s) => s.type === "Other").length;

    // Greina iOS vs Other failed subscriptions
    const iosFailed = failedDetails.filter((f: any) => 
      f.endpoint?.includes("push.apple.com") || f.endpoint?.includes("safari")
    ).length;
    const otherFailed = failedDetails.length - iosFailed;

    return NextResponse.json({
      ok: true,
      sent: successful,
      failed,
      total: subscriptions.length,
      iosSubscriptions,
      otherSubscriptions,
      iosFailed,
      otherFailed,
      subscriptionInfo,
      failedDetails: failedDetails.length > 0 ? failedDetails : undefined,
    });
  } catch (error: any) {
    console.error("Push notification error:", error);
    return NextResponse.json(
      { error: error.message || "Óvænt villa" },
      { status: 500 }
    );
  }
}
