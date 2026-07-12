import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) return;
  const normalized = phone.replace(/^0/, "234").replace(/\s+/g, "");
  await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key:  apiKey,
      to:       normalized,
      from:     process.env.TERMII_SENDER_ID ?? "StreetdocMD",
      sms:      message,
      type:     "plain",
      channel:  "generic",
    }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng, address } = await req.json();

  const { data: profile } = await supabase
    .from("users")
    .select("name, phone")
    .eq("id", user.id)
    .single();

  const admin = createAdminSupabase();

  const { data: emergency, error } = await admin
    .from("emergencies")
    .insert({ patient_id: user.id, lat: lat ?? null, lng: lng ?? null, address: address ?? null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch all active responder numbers
  const { data: contacts } = await admin
    .from("emergency_contacts")
    .select("phone")
    .eq("is_active", true);

  const mapLink = lat && lng ? `\nMap: https://maps.google.com/?q=${lat},${lng}` : "";
  const sms = [
    "STREETDOCMD EMERGENCY",
    `Patient: ${profile?.name ?? "Unknown"}`,
    profile?.phone ? `Phone: ${profile.phone}` : null,
    address ? `Location: ${address}` : null,
    mapLink || null,
    "CALL PATIENT IMMEDIATELY",
  ].filter(Boolean).join("\n");

  if (contacts?.length) {
    await Promise.allSettled(contacts.map(c => sendSMS(c.phone, sms)));
  }

  return NextResponse.json({ ok: true, id: emergency.id });
}