import { NextResponse } from "next/server";

export async function GET() {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    
    if (!vapidPublicKey) {
      console.error("VAPID public key not configured in environment variables");
      console.error("Available env keys with VAPID:", Object.keys(process.env).filter(k => k.includes("VAPID")));
      return NextResponse.json(
        { 
          error: "VAPID public key not configured",
          debug: {
            hasKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
            allVapidKeys: Object.keys(process.env).filter(k => k.includes("VAPID")),
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ publicKey: vapidPublicKey });
  } catch (error: any) {
    console.error("Error getting VAPID key:", error);
    return NextResponse.json(
      { 
        error: "Failed to get VAPID key",
        message: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
