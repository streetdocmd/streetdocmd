import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// Specialties an admin can create a hospital-affiliated provider account
// for. Only Physiotherapist today — Lab Technicians affiliate with a Lab
// Partner instead, via the existing lab_staff mechanism, not this route.
const HOSPITAL_AFFILIATED_SPECIALTIES: Record<string, { licenseBody: string; licenseLabel: string }> = {
  "Physiotherapist": { licenseBody: "MRTB", licenseLabel: "MRTB Registration Number" },
};

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminSupabase();
    const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
    if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const hospitalPartnerId = req.nextUrl.searchParams.get("hospital_partner_id");
    let query = admin
      .from("providers")
      .select("id, name, specialty, license_body, license_number, verification_status, hospital_partner_id, hospital_partners(name)")
      .not("hospital_partner_id", "is", null)
      .order("name");
    if (hospitalPartnerId) query = query.eq("hospital_partner_id", hospitalPartnerId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ providers: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminSupabase();
    const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
    if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const {
      hospital_partner_id, name, email, phone, password,
      specialty, license_number, credentials, years_experience,
    } = body;

    if (!hospital_partner_id || !name || !email || !phone || !password || !specialty || !license_number || !credentials) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const practitionerType = HOSPITAL_AFFILIATED_SPECIALTIES[specialty];
    if (!practitionerType) {
      return NextResponse.json({ error: `"${specialty}" cannot be created as a hospital-affiliated provider.` }, { status: 400 });
    }

    const { data: hospital } = await admin.from("hospital_partners").select("id").eq("id", hospital_partner_id).single();
    if (!hospital) return NextResponse.json({ error: "Hospital partner not found" }, { status: 404 });

    // Unlike self-registration, this is admin deliberately creating a new
    // account — an existing email is a real conflict, not a resubmission.
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    const userId = authData.user.id;

    const { error: userErr } = await admin.from("users").insert({ id: userId, name, phone, role: "provider" });
    if (userErr) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    // verification_status is left at its table default ("pending") — an
    // admin-created affiliated provider still goes through the normal
    // document upload + review flow, same as anyone self-registering.
    const { data: provider, error: provErr } = await admin.from("providers").insert({
      user_id: userId,
      name,
      phone,
      specialty,
      credentials,
      license_body: practitionerType.licenseBody,
      license_number,
      years_experience: parseInt(years_experience) || 0,
      hospital_partner_id,
    }).select("id, name, specialty").single();

    if (provErr) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: provErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
