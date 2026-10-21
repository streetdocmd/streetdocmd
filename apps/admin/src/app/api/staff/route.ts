import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[randomInt(chars.length)];
  return pass;
}

const ROLE: Record<string, string> = { lab: "lab_staff", pharmacy: "pharmacy_staff", hospital: "hospital_staff" };
const STAFF: Record<string, { table: string; fk: string }> = {
  lab:      { table: "lab_staff",      fk: "lab_partner_id" },
  pharmacy: { table: "pharmacy_staff", fk: "pharmacy_partner_id" },
  hospital: { table: "hospital_staff", fk: "hospital_partner_id" },
};
const PORTAL_URLS: Record<string, string> = {
  lab:      "https://admin.streetdocmd.com/lab-portal/login",
  pharmacy: "https://admin.streetdocmd.com/pharmacy-portal/login",
  hospital: "https://admin.streetdocmd.com/hospital-portal/login",
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminApi();
    if ("response" in auth) return auth.response;
    const admin = createAdminSupabase();

    const { name, email, phone, facility_type, partner_id } = await req.json();
    if (!name || !email || !facility_type || !partner_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const role = ROLE[facility_type];
    const staff = STAFF[facility_type];
    if (!role || !staff) return NextResponse.json({ error: `Unknown facility type: ${facility_type}` }, { status: 400 });

    const tempPassword = generateTempPassword();
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, facility_type, partner_id },
    });
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: authErr?.message ?? "Failed to create the login" }, { status: 400 });
    }
    const userId = authData.user.id;
    const undo = () => admin.auth.admin.deleteUser(userId); // users / *_staff rows cascade

    // users has no email column in the live DB — don't write one.
    const { error: userErr } = await admin.from("users").upsert(
      { id: userId, name, phone: phone || null, role },
      { onConflict: "id", ignoreDuplicates: false }
    );
    if (userErr) {
      await undo();
      return NextResponse.json({ error: `Could not set the account role: ${userErr.message}` }, { status: 500 });
    }

    const { error: staffErr } = await admin.from(staff.table).insert({ user_id: userId, [staff.fk]: partner_id });
    if (staffErr) {
      await undo();
      return NextResponse.json({ error: `Could not link the login to the facility: ${staffErr.message}` }, { status: 500 });
    }

    const termiiKey = process.env.TERMII_API_KEY;
    if (termiiKey && phone) {
      await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone, from: "StreetdocMD",
          sms: `You have been added to the StreetdocMD partner portal. Login: ${PORTAL_URLS[facility_type]} Email: ${email} Password: ${tempPassword}. Please change your password on first login.`,
          type: "plain", channel: "generic", api_key: termiiKey,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, temp_password: tempPassword, user_id: userId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected server error." }, { status: 500 });
  }
}
