import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const STAFF_ROLE: Record<string, string> = { lab: "lab_staff", pharmacy: "pharmacy_staff", hospital: "hospital_staff" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Checks an email/password pair without creating a session cookie. */
async function verifyPassword(email: string, password: string): Promise<string | null> {
  const anon = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  return error || !data.user ? null : data.user.id;
}

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const facility_type = str(body.facility_type, 20);
  const name = str(body.name, 200);
  const email = str(body.email, 200).toLowerCase();
  const phone = str(body.phone, 30);
  const address = str(body.address, 500);
  const password = body.password;

  if (!name || !email || !phone || !address) {
    return NextResponse.json({ error: "Please fill in the facility name, email, phone number and address." }, { status: 400 });
  }
  if (!STAFF_ROLE[facility_type]) {
    return NextResponse.json({ error: "Invalid facility type" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Keep the applicant's questions with the application; reviewers see every
  // type_specific_data field on the review page.
  const typeData = body.type_specific_data && typeof body.type_specific_data === "object" && !Array.isArray(body.type_specific_data)
    ? { ...body.type_specific_data }
    : {};
  const questions = str(body.questions, 2000);
  if (questions) typeData.questions_or_suggestions = questions;

  // Create the portal login now, so the facility can sign straight into its portal
  // (which shows "under review" until an admin approves and links the partner record).
  let userId: string;
  let createdNewUser = false;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: str(body.contact_person_name, 200) || name, facility_type },
  });

  if (authUser?.user) {
    userId = authUser.user.id;
    createdNewUser = true;
  } else {
    const taken = /already|registered|exists/i.test(authErr?.message ?? "");
    if (!taken) {
      console.error("facility apply: createUser failed:", authErr);
      return NextResponse.json({ error: authErr?.message ?? "Could not create account" }, { status: 500 });
    }

    // The email already has a login. Allow it only for a facility re-applying
    // after a rejection, proven by the password it registered with.
    const existingId = await verifyPassword(email, password);
    if (!existingId) {
      return NextResponse.json({
        error: "An account with this email already exists. If you registered before, sign in to your portal to see your application, or use a different email.",
      }, { status: 409 });
    }
    const [{ data: existingUser }, { data: lastApp }] = await Promise.all([
      admin.from("users").select("role").eq("id", existingId).maybeSingle(),
      admin.from("facility_applications").select("status, facility_type").eq("user_id", existingId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (existingUser && existingUser.role !== STAFF_ROLE[facility_type]) {
      return NextResponse.json({
        error: "This email is already used by another StreetdocMD account. Please register your facility with a different email.",
      }, { status: 409 });
    }
    if (!lastApp || lastApp.status !== "rejected") {
      return NextResponse.json({
        error: !lastApp || lastApp.status === "approved"
          ? "This email already has a partner account. Sign in to your portal instead, or use a different email."
          : "You've already applied with this email. Sign in to your portal to check your application status.",
      }, { status: 409 });
    }
    userId = existingId;
  }

  const { error: userErr } = await admin.from("users").upsert({
    id: userId,
    name: str(body.contact_person_name, 200) || name,
    phone,
    role: STAFF_ROLE[facility_type],
  }, { onConflict: "id" });
  if (userErr) {
    if (createdNewUser) await admin.auth.admin.deleteUser(userId);
    const phoneTaken = /phone/i.test(userErr.message) && /duplicate|unique/i.test(userErr.message);
    const roleCheck = /users_role_check/i.test(userErr.message);
    console.error("facility apply: users upsert failed:", userErr);
    return NextResponse.json(
      {
        error: phoneTaken
          ? "This phone number is already linked to another StreetdocMD account. Use a different number for your facility."
          : roleCheck
            ? "We couldn't create your account right now. Please contact support on WhatsApp 07063216791."
            : userErr.message,
      },
      { status: phoneTaken ? 409 : 500 }
    );
  }

  const { data, error } = await admin
    .from("facility_applications")
    .insert({
      facility_type, name, email, phone, address,
      city: str(body.city, 100) || null,
      state: str(body.state, 100) || null,
      registration_number: str(body.registration_number, 100) || null,
      cac_number: str(body.cac_number, 100) || null,
      contact_person_name: str(body.contact_person_name, 200) || null,
      contact_person_role: str(body.contact_person_role, 200) || null,
      operating_hours: str(body.operating_hours, 200) || null,
      type_specific_data: typeData,
      documents: body.documents ?? null,
      status: "pending",
      user_id: userId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("facility_application insert error:", error);
    if (createdNewUser) await admin.auth.admin.deleteUser(userId); // users row cascades
    return NextResponse.json({ error: "We couldn't save your application. Please try again, or contact support on WhatsApp 07063216791." }, { status: 500 });
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
        sms: `New facility application${createdNewUser ? "" : " (re-application)"}: ${name} (${facility_type}). Email: ${email}. Phone: ${phone}. Review at /dashboard/facilities/${data.id}`,
        type: "plain",
        channel: "generic",
        api_key: termiiKey,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ id: data.id });
}
