import { NextResponse } from "next/server";

// Fallback VAPID public key - notaður ef environment variable er ekki til staðar
// Þetta er í lagi því public key er ætlaður að vera public
const FALLBACK_VAPID_PUBLIC_KEY = "BFU2gUkANWpqw0yciW3WoX5fl6OWGjlHXk-e5t_tSaqwWBbt5_lvCX59m3jMLydkuLlU735Ci2_CkT6v0pDCQeU";

export async function GET() {
  try {
    // Prófa bæði NEXT_PUBLIC_ (build-time) og VAPID_PUBLIC_KEY (runtime)
    // API routes geta lesið ALLAR environment variables á runtime
    const vapidPublicKey = 
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
      process.env.VAPID_PUBLIC_KEY || 
      FALLBACK_VAPID_PUBLIC_KEY; // Fallback ef environment variable er ekki til staðar
    
    if (!vapidPublicKey) {
      console.error("VAPID public key not configured in environment variables");
      console.error("Available env keys with VAPID:", Object.keys(process.env).filter(k => k.includes("VAPID")));
      return NextResponse.json(
        { 
          error: "VAPID public key not configured",
          debug: {
            hasNextPublicKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
            hasVapidPublicKey: Boolean(process.env.VAPID_PUBLIC_KEY),
            allVapidKeys: Object.keys(process.env).filter(k => k.includes("VAPID")),
          }
        },
        { status: 500 }
      );
    }

    // Log ef fallback er notaður
    if (vapidPublicKey === FALLBACK_VAPID_PUBLIC_KEY) {
      console.warn("Using fallback VAPID public key - environment variable not found");
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
