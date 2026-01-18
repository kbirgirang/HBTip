import { NextResponse } from "next/server";

export async function GET() {
  // Test all environment variables related to VAPID
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ? "SET" : "NOT SET";
  const vapidSubject = process.env.VAPID_SUBJECT;

  return NextResponse.json({
    hasVapidPublicKey: Boolean(vapidPublicKey),
    vapidPublicKeyLength: vapidPublicKey?.length || 0,
    vapidPublicKeyPrefix: vapidPublicKey?.substring(0, 20) || "N/A",
    hasVapidPrivateKey: vapidPrivateKey === "SET",
    vapidSubject: vapidSubject || "NOT SET",
    allEnvKeys: Object.keys(process.env).filter((key) => key.includes("VAPID")),
  });
}
