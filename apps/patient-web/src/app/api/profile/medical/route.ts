import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    dob,
    gender,
    blood_group,
    known_conditions,
    current_medications,
    allergies,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
  } = body;

  const admin = createAdminSupabase();
  const { error } = await admin.from("users").update({
    dob,
    gender,
    blood_group,
    known_conditions: known_conditions ?? [],
    current_medications: current_medications ?? [],
    allergies: allergies ?? [],
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}