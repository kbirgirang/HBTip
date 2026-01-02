import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/session";

type Body = {
  adminPassword: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const adminPassword = (body.adminPassword || "").trim();

    if (!adminPassword) {
      return NextResponse.json({ error: "Admin lykilorð vantar." }, { status: 400 });
    }

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json({ error: "ADMIN_PASSWORD er ekki sett á server." }, { status: 500 });
    }

    if (adminPassword !== expected) {
      return NextResponse.json({ error: "Rangt admin lykilorð." }, { status: 401 });
    }

    await setAdminSession();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Óvænt villa." }, { status: 500 });
  }
}

