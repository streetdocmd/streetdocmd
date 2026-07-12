import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const body = await req.json();

  const {
    facility_type, name, email, phone, address, city, state,
    registration_number, cac_number, contact_person_name, contact_person_role,
    operating_hours, type_specific_data, documents,
  } = body;

  if (!facility_type || !name || !email || !phone || !address) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("facility_applications")
    .insert({
      facility_type, name, email, phone, address, city, state,
      registration_number, cac_number, contact_person_name, contact_person_role,
      operating_hours, type_specific_data, documents,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("facility_application insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify admin via Termii SMS to the ops team
  const termiiKey = process.env.TERMII_API_KEY;
  const opsPhone  = process.env.OPS_PHONE ?? "2347063216791";
  if (termiiKey) {
    await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: opsPhone,
        from: "StreetdocMD",
        sms: `New facility application: ${name} (${facility_type}). Email: ${email}. Phone: ${phone}. Review at /dashboard/facilities/${data.id}`,
        type: "plain",
        channel: "generic",
        api_key: termiiKey,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ id: data.id });
}
