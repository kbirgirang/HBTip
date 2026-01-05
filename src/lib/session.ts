import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "ehf_pool_session";
const USER_COOKIE_NAME = "ehf_pool_user_session";
const ADMIN_COOKIE_NAME = "ehf_pool_admin_session";

const secretString = process.env.APP_SESSION_SECRET;
if (!secretString) {
  throw new Error("APP_SESSION_SECRET is not set in .env.local");
}
const secret = new TextEncoder().encode(secretString);

export type SessionPayload = {
  roomId: string;
  memberId: string;
  roomCode: string;
  role: "player" | "owner";
};

export type UserSessionPayload = {
  username: string;
  userId: string;
  loggedInAt: number;
};

export type AdminSessionPayload = {
  role: "admin";
  loggedInAt: number;
};

export async function setSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  // Use object-form to satisfy Next.js typings
  (await cookies()).set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

// User session management (global login, not room-specific)
export async function setUserSession(payload: UserSessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  (await cookies()).set({
    name: USER_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getUserSession(): Promise<UserSessionPayload | null> {
  const token = (await cookies()).get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}

export async function clearUserSession() {
  (await cookies()).delete(USER_COOKIE_NAME);
}

// Admin session management
export async function setAdminSession() {
  const payload: AdminSessionPayload = {
    role: "admin",
    loggedInAt: Date.now(),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // Admin sessions expire after 24 hours
    .sign(secret);

  (await cookies()).set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE_NAME);
}
