import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, address, phone, email, lat, lng, home_collection_available } = body;
  if (!name || !address || !phone) return NextResponse.json({ error: "name, address, phone required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data, error } = await admin.from("lab_partners").insert({
    name,
    address,
    phone,
    email: email || null,
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    home_collection_available: !!home_collection_available,
    active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
