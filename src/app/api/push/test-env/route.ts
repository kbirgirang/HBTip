import { NextResponse } from "next/server";

export async function GET() {
  // Test all environment variables related to VAPID
  // API routes geta lesið ALLAR environment variables (ekki bara NEXT_PUBLIC_*)
  const vapidPublicKeyNext = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ? "SET" : "NOT SET";
  const vapidSubject = process.env.VAPID_SUBJECT;

  // Prófa bæði nöfn
  const publicKey = vapidPublicKeyNext || vapidPublicKey;

  return NextResponse.json({
    hasVapidPublicKey: Boolean(publicKey),
    vapidPublicKeyLength: publicKey?.length || 0,
    vapidPublicKeyPrefix: publicKey?.substring(0, 20) || "N/A",
    hasVapidPrivateKey: vapidPrivateKey === "SET",
    vapidSubject: vapidSubject || "NOT SET",
    hasNextPublicKey: Boolean(vapidPublicKeyNext),
    hasVapidPublicKeyNoPrefix: Boolean(vapidPublicKey),
    allEnvKeys: Object.keys(process.env).filter((key) => key.includes("VAPID")),
  });
}
