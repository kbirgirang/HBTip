import { NextResponse } from "next/server";

export async function GET() {
  const isSet = !!process.env.ADMIN_PASSWORD;
  return NextResponse.json({ adminPasswordConfigured: isSet });
}

