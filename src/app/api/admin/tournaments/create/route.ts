import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdminSession } from "@/lib/adminAuth";

type Body = {
  slug: string;
  name: string;
  isActive?: boolean;
};

export async function POST(req: Request) {
  const authError = await requireAdminSession();
  if (authError) return authError;

  const body = (await req.json()) as Body;
  const slug = (body.slug || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const isActive = body.isActive !== undefined ? body.isActive : true;

  if (!slug) return NextResponse.json({ error: "Slug vantar" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nafn vantar" }, { status: 400 });
  if (slug.length < 3) return NextResponse.json({ error: "Slug þarf að vera amk 3 stafir" }, { status: 400 });
  if (name.length < 3) return NextResponse.json({ error: "Nafn þarf að vera amk 3 stafir" }, { status: 400 });

  // Validate slug format (only lowercase letters, numbers, hyphens)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug má aðeins innihalda lágstafi, tölur og bandstrik" }, { status: 400 });
  }

  const { data: tournament, error: tErr } = await supabaseServer
    .from("tournaments")
    .insert({
      slug,
      name,
      is_active: isActive,
    })
    .select("id, slug, name, is_active")
    .single();

  if (tErr) {
    if (tErr.code === "23505" || tErr.message?.includes("unique")) {
      return NextResponse.json({ error: "Keppni með þetta slug er þegar til" }, { status: 400 });
    }
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  // Búa til admin_settings fyrir nýju keppnina
  await supabaseServer
    .from("admin_settings")
    .insert({
      tournament_id: tournament.id,
      points_per_correct_1x2: 1,
      timezone: "Atlantic/Reykjavik",
    })
    .select();

  return NextResponse.json({ tournament });
}

