import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

const GENDERS = ["male", "female", "other"];

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean).slice(0, 50) : [];
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const dob = strOrNull(body.dob);
  if (dob && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(Date.parse(dob)) || new Date(dob) > new Date())) {
    return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
  }
  const gender = strOrNull(body.gender);
  if (gender && !GENDERS.includes(gender)) {
    return NextResponse.json({ error: "Please select a valid gender." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.from("users").update({
    dob,
    gender,
    blood_group: strOrNull(body.blood_group),
    known_conditions: strList(body.known_conditions),
    current_medications: strList(body.current_medications),
    allergies: strList(body.allergies),
    emergency_contact_name: strOrNull(body.emergency_contact_name),
    emergency_contact_phone: strOrNull(body.emergency_contact_phone),
    emergency_contact_relationship: strOrNull(body.emergency_contact_relationship),
    updated_at: new Date().toISOString(),
  }).eq("id", user.id).select("id");

  if (error) {
    console.error("[profile/medical] update failed:", error);
    return NextResponse.json({ error: "We couldn't save your profile. Please try again." }, { status: 500 });
  }
  // An update that matched no row would otherwise "succeed" and silently
  // drop everything the patient entered.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Your account setup isn't complete. Please finish sign-up first." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
