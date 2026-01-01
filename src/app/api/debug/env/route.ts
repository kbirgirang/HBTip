import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasSessionSecret: Boolean(process.env.APP_SESSION_SECRET),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
  });
}
