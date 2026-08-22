import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

// PATCH — mark under_review
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { action } = await req.json();

  if (action !== "under_review") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  await admin
    .from("facility_applications")
    .update({ status: "under_review" })
    .eq("id", params.id);

  return NextResponse.json({ ok: true });
}

// POST — approve or reject
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();

  const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
  if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, rejection_reason } = body;

  const { data: app } = await admin
    .from("facility_applications")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "reject") {
    await admin.from("facility_applications").update({
      status: "rejected",
      rejection_reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", params.id);

    // Notify via SMS
    const termiiKey = process.env.TERMII_API_KEY;
    if (termiiKey && app.phone) {
      await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: app.phone, from: "StreetdocMD",
          sms: `StreetdocMD Partner Application: Unfortunately, your application for ${app.name} was not approved. Reason: ${rejection_reason}. You may reapply after addressing the issues. Contact: 07063216791`,
          type: "plain", channel: "generic", api_key: termiiKey,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const tempPassword = generateTempPassword();
    const typeData = app.type_specific_data ?? {};

    // Create partner record
    let partnerId: string | null = null;

    if (app.facility_type === "lab") {
      const { data: partner } = await admin.from("lab_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat,
        lng: app.lng,
        home_collection_available: typeData.home_collection ?? false,
        active: true,
      }).select("id").single();
      partnerId = partner?.id ?? null;

    } else if (app.facility_type === "pharmacy") {
      const { data: partner } = await admin.from("pharmacy_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat,
        lng: app.lng,
        delivery_radius_km: parseFloat(typeData.delivery_radius_km ?? "5"),
        active: true,
      }).select("id").single();
      partnerId = partner?.id ?? null;

    } else if (app.facility_type === "hospital") {
      const specialties = Array.isArray(typeData.specialties)
        ? typeData.specialties.filter(Boolean)
        : [];
      const { data: partner } = await admin.from("hospital_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat,
        lng: app.lng,
        hospital_level: typeData.hospital_level ?? "secondary",
        emergency_available: typeData.emergency_available ?? true,
        ambulance_available: typeData.ambulance_available ?? false,
        bed_count: typeData.bed_count ? parseInt(typeData.bed_count) : null,
        specialties,
        active: true,
      }).select("id").single();
      partnerId = partner?.id ?? null;
    }

    // Create auth user
    const roleMap: Record<string, string> = { lab: "lab_staff", pharmacy: "pharmacy_staff", hospital: "hospital_staff" };
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: app.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: app.contact_person_name ?? app.name,
        facility_type: app.facility_type,
        partner_id: partnerId,
      },
    });

    if (authErr || !authUser?.user) {
      return NextResponse.json({ error: authErr?.message ?? "Failed to create user" }, { status: 500 });
    }

    // Insert into users table
    await admin.from("users").upsert({
      id: authUser.user.id,
      email: app.email,
      name: app.contact_person_name ?? app.name,
      phone: app.phone,
      role: roleMap[app.facility_type] ?? "lab_staff",
    }, { onConflict: "id", ignoreDuplicates: false });

    // Insert into staff table
    if (partnerId) {
      if (app.facility_type === "lab") {
        await admin.from("lab_staff").insert({ user_id: authUser.user.id, lab_partner_id: partnerId });
      } else if (app.facility_type === "pharmacy") {
        await admin.from("pharmacy_staff").insert({ user_id: authUser.user.id, pharmacy_partner_id: partnerId });
      } else if (app.facility_type === "hospital") {
        await admin.from("hospital_staff").insert({ user_id: authUser.user.id, hospital_partner_id: partnerId });
      }
    }

    // Mark application approved
    await admin.from("facility_applications").update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", params.id);

    // Notify via SMS
    const portalUrls: Record<string, string> = {
      lab: "https://admin.streetdocmd.com/lab-portal/login",
      pharmacy: "https://admin.streetdocmd.com/pharmacy-portal/login",
      hospital: "https://admin.streetdocmd.com/hospital-portal/login",
    };
    const termiiKey = process.env.TERMII_API_KEY;
    if (termiiKey && app.phone) {
      await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: app.phone, from: "StreetdocMD",
          sms: `Welcome to StreetdocMD Partner Network! Your facility ${app.name} has been approved. Log in at: ${portalUrls[app.facility_type]} Email: ${app.email} Temp password: ${tempPassword} Please change your password on first login.`,
          type: "plain", channel: "generic", api_key: termiiKey,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, temp_password: tempPassword, partner_id: partnerId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
