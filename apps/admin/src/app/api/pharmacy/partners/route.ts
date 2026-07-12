import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, phone, email, address, lat, lng, active } = body;
  if (!name || !phone) return NextResponse.json({ error: "name and phone required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data, error } = await admin.from("pharmacy_partners").insert({
    name, phone, email, address,
    lat: lat ?? null, lng: lng ?? null,
    active: active ?? true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
