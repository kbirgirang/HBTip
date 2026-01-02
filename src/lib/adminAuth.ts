import { NextResponse } from "next/server";
import { getAdminSession } from "./session";

/**
 * Check if the current request has a valid admin session.
 * Returns null if authenticated, or a NextResponse with error if not.
 */
export async function requireAdminSession(): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Ekki innskráður admin." }, { status: 401 });
  }
  return null;
}

