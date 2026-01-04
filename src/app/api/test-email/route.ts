import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function GET() {
  // Debug endpoint - show environment variable status
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const allEnvKeys = Object.keys(process.env);
  const resendKeys = allEnvKeys.filter(k => k.toLowerCase().includes('resend'));
  const emailKeys = allEnvKeys.filter(k => k.toLowerCase().includes('email'));

  // Check if hardcoded fallback would be used
  const willUseFallback = !hasApiKey;
  const fallbackKey = "re_jL9XEt9v_LJtayDxGhdek3DtBBNLbUNyx";

  return NextResponse.json({
    hasApiKey,
    emailFrom,
    resendKeysFound: resendKeys,
    emailKeysFound: emailKeys,
    exactResendKey: process.env.RESEND_API_KEY ? "exists" : "missing",
    exactEmailFrom: process.env.EMAIL_FROM ? "exists" : "missing",
    willUseFallback,
    fallbackAvailable: willUseFallback ? "yes (hardcoded)" : "no",
    message: "Use POST with {to: 'email@example.com'} to test email sending",
    note: willUseFallback ? "Email sending will use hardcoded fallback API key" : "Email sending will use environment variable",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: "Email address required" }, { status: 400 });
    }

    // Check environment variables
    const hasApiKey = Boolean(process.env.RESEND_API_KEY);
    const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
    
    // Debug: show all env keys
    const allEnvKeys = Object.keys(process.env);
    const resendKeys = allEnvKeys.filter(k => k.toLowerCase().includes('resend'));
    const emailKeys = allEnvKeys.filter(k => k.toLowerCase().includes('email'));

    // Try to send email
    console.log("Test email endpoint called with:", { to, hasApiKey, emailFrom });
    
    const success = await sendEmail(
      to,
      "Test Email - Evrópumótið í handbolta 2026 ",
      "Þetta er test email. Ef þú sérð þetta, þá virkar email sending!"
    );

    console.log("Email sending result:", { success, to });

    let errorMessage = "Failed to send email - check Vercel Function Logs for details";
    let errorDetails = null;
    
    // Check if it's a domain verification error (common Resend issue)
    if (!success && to !== "kbirgir@gmail.com") {
      errorMessage = "Domain verification required. Resend only allows sending to your verified email (kbirgir@gmail.com) for testing. To send to other emails, verify a domain at resend.com/domains and use an email from that domain as the 'from' address.";
      errorDetails = {
        note: "Try sending to kbirgir@gmail.com to test, or verify a domain in Resend",
        resendDomains: "https://resend.com/domains"
      };
    }

    return NextResponse.json({
      success,
      hasApiKey,
      emailFrom,
      resendKeysFound: resendKeys,
      emailKeysFound: emailKeys,
      usingFallback: !hasApiKey,
      message: success 
        ? "Email sent successfully" 
        : errorMessage,
      ...(errorDetails && { errorDetails }),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error",
    }, { status: 500 });
  }
}

