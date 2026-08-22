import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

export async function POST(req: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
  if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, phone, facility_type, partner_id } = await req.json();
  if (!name || !email || !facility_type || !partner_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const roleMap: Record<string, string> = {
    lab:      "lab_staff",
    pharmacy: "pharmacy_staff",
    hospital: "hospital_staff",
  };

  // Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, facility_type, partner_id },
  });
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: authErr?.message ?? "Failed to create auth user" }, { status: 500 });
  }

  // Insert into users table
  await admin.from("users").upsert({
    id: authData.user.id,
    email,
    name,
    phone: phone ?? null,
    role: roleMap[facility_type] ?? "lab_staff",
  }, { onConflict: "id", ignoreDuplicates: false });

  // Insert into correct staff table
  if (facility_type === "lab") {
    await admin.from("lab_staff").insert({ user_id: authData.user.id, lab_partner_id: partner_id });
  } else if (facility_type === "pharmacy") {
    await admin.from("pharmacy_staff").insert({ user_id: authData.user.id, pharmacy_partner_id: partner_id });
  } else if (facility_type === "hospital") {
    await admin.from("hospital_staff").insert({ user_id: authData.user.id, hospital_partner_id: partner_id });
  }

  // Notify via SMS
  const termiiKey = process.env.TERMII_API_KEY;
  const portalUrls: Record<string, string> = {
    lab:      "https://admin.streetdocmd.com/lab-portal/login",
    pharmacy: "https://admin.streetdocmd.com/pharmacy-portal/login",
    hospital: "https://admin.streetdocmd.com/hospital-portal/login",
  };
  if (termiiKey && phone) {
    await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone, from: "StreetdocMD",
        sms: `You have been added to the StreetdocMD partner portal. Login: ${portalUrls[facility_type]} Email: ${email} Password: ${tempPassword}. Please change your password on first login.`,
        type: "plain", channel: "generic", api_key: termiiKey,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, temp_password: tempPassword, user_id: authData.user.id });
}
