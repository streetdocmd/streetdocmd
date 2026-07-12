import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await (await auth).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await admin.from("hospital_partners").insert({
    name:                 body.name,
    address:              body.address ?? null,
    phone:                body.phone ?? null,
    email:                body.email ?? null,
    lat:                  body.lat ?? null,
    lng:                  body.lng ?? null,
    hospital_level:       body.hospital_level ?? "secondary",
    emergency_available:  body.emergency_available ?? false,
    ambulance_available:  body.ambulance_available ?? false,
    bed_count:            body.bed_count ?? null,
    specialties:          body.specialties ?? [],
    active:               true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
