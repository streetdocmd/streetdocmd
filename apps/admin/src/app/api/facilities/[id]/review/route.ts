import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

type Admin = ReturnType<typeof createAdminSupabase>;

const OPEN_STATUSES = ["pending", "under_review"];
const STAFF_ROLE: Record<string, string> = { lab: "lab_staff", pharmacy: "pharmacy_staff", hospital: "hospital_staff" };
const STAFF_TABLE: Record<string, { table: string; fk: string }> = {
  lab:      { table: "lab_staff",      fk: "lab_partner_id" },
  pharmacy: { table: "pharmacy_staff", fk: "pharmacy_partner_id" },
  hospital: { table: "hospital_staff", fk: "hospital_partner_id" },
};
const PORTAL_URLS: Record<string, string> = {
  lab:      "https://provider.streetdocmd.com/lab-portal/login",
  pharmacy: "https://provider.streetdocmd.com/pharmacy-portal/login",
  hospital: "https://provider.streetdocmd.com/hospital-portal/login",
};
// A login that already belongs to one of these roles must never be silently
// converted into facility staff (it would lock them out of their own app).
const PROTECTED_ROLES = ["admin", "provider", "patient"];

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[randomInt(chars.length)];
  return pass;
}

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function sendSms(to: string | null | undefined, sms: string) {
  const termiiKey = process.env.TERMII_API_KEY;
  if (!termiiKey || !to) return false;
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, from: "StreetdocMD", sms, type: "plain", channel: "generic", api_key: termiiKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Legacy applications have no user_id — find an existing login for the email, if any. */
async function findAuthUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

// PATCH — mark under_review
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const { action } = await req.json().catch(() => ({ action: null }));
  if (action !== "under_review") return json("Invalid action", 400);

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("facility_applications")
    .update({ status: "under_review" })
    .eq("id", params.id)
    .eq("status", "pending")
    .select("id");

  if (error) return json(`Could not update the application: ${error.message}`, 500);
  if (!updated || updated.length === 0) {
    return json("Only a pending application can be marked under review — it may already have been actioned. Refresh to see its current status.", 409);
  }
  return NextResponse.json({ ok: true });
}

// POST — approve or reject
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi();
    if ("response" in auth) return auth.response;
    const reviewer = auth.user;

    const admin = createAdminSupabase();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const { data: app, error: appLoadErr } = await admin
      .from("facility_applications")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (appLoadErr) return json(`Could not load the application: ${appLoadErr.message}`, 500);
    if (!app) return json("Application not found.", 404);

    // ── Reject ────────────────────────────────────────────────────────────
    if (action === "reject") {
      const reason = typeof body.rejection_reason === "string" ? body.rejection_reason.trim() : "";
      if (!reason) return json("Please give a reason so the facility knows what to fix.", 400);
      if (!OPEN_STATUSES.includes(app.status)) {
        return json(
          app.status === "approved"
            ? "This application is already approved. To stop this partner, deactivate it from the Labs, Pharmacy or Hospitals page instead."
            : "This application has already been rejected.",
          409
        );
      }

      const { data: updated, error } = await admin
        .from("facility_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_by: reviewer.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .in("status", OPEN_STATUSES)
        .select("id");
      if (error) return json(`Could not reject the application: ${error.message}`, 500);
      if (!updated || updated.length === 0) return json("This application was just actioned by someone else. Refresh to see its current status.", 409);

      const smsSent = await sendSms(
        app.phone,
        `StreetdocMD Partner Application: Unfortunately, your application for ${app.name} was not approved. Reason: ${reason}. You may reapply after addressing the issues. Contact: contact@streetdocmd.com`
      );
      return NextResponse.json({ ok: true, sms_sent: smsSent });
    }

    if (action !== "approve") return json("Unknown action", 400);

    // ── Approve ───────────────────────────────────────────────────────────
    if (app.status === "approved") return json("This application is already approved.", 409);
    if (app.status === "rejected") return json("This application was rejected. Ask the facility to submit a new application.", 409);

    const facilityType: string = app.facility_type;
    const role = STAFF_ROLE[facilityType];
    const staff = STAFF_TABLE[facilityType];
    if (!role || !staff) return json(`Unknown facility type: ${facilityType}`, 400);

    const typeData = app.type_specific_data ?? {};
    const fail = (step: string, message?: string) => json(`${step}: ${message ?? "unknown error"}`, 500);

    // 1. Work out which login to link BEFORE creating anything, so a refusal leaves nothing behind.
    let userId: string | null = app.user_id ?? null;
    let createdLogin = false;
    let tempPassword: string | null = null;

    // Legacy application: an earlier (failed) approval may already have created
    // a login for this email. Reuse it, with a fresh temporary password, since
    // nobody ever received the old one.
    let reusedLegacyLogin = false;
    if (!userId && app.email) {
      userId = await findAuthUserIdByEmail(admin, app.email);
      reusedLegacyLogin = !!userId;
    }
    if (userId) {
      const { data: existing, error: existingErr } = await admin.from("users").select("role").eq("id", userId).maybeSingle();
      if (existingErr) return fail("Could not check the facility login", existingErr.message);
      let protectedAccount = !!existing?.role && existing.role !== role && PROTECTED_ROLES.includes(existing.role);
      if (protectedAccount && existing?.role === "patient") {
        // A login left behind by an earlier failed approval carries the default
        // 'patient' role but has never been used — only a patient with real
        // bookings is a genuine patient account.
        const { count } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("patient_id", userId);
        protectedAccount = (count ?? 0) > 0;
      }
      if (protectedAccount) {
        return json(
          `${app.email} already belongs to a StreetdocMD ${existing?.role} account, so it can't also be used as this facility's portal login. Ask the facility to register with a different email.`,
          409
        );
      }
    }

    // 2. Create the partner record.
    let partnerId: string;
    const partnerTable = `${facilityType}_partners`;
    if (facilityType === "lab") {
      const { data: partner, error } = await admin.from("lab_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat ?? null,
        lng: app.lng ?? null,
        home_collection_available: !!typeData.home_collection,
        active: true,
      }).select("id").single();
      if (error || !partner) return fail("Could not create lab partner", error?.message);
      partnerId = partner.id;
    } else if (facilityType === "pharmacy") {
      const { data: partner, error } = await admin.from("pharmacy_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat ?? null,
        lng: app.lng ?? null,
        delivery_radius_km: parseFloat(typeData.delivery_radius_km ?? "5") || 5,
        active: true,
      }).select("id").single();
      if (error || !partner) return fail("Could not create pharmacy partner", error?.message);
      partnerId = partner.id;
    } else {
      const specialties = Array.isArray(typeData.specialties) ? typeData.specialties.filter(Boolean) : [];
      const bedCount = typeData.bed_count ? parseInt(typeData.bed_count, 10) : NaN;
      const { data: partner, error } = await admin.from("hospital_partners").insert({
        name: app.name,
        address: app.address,
        phone: app.phone,
        email: app.email,
        lat: app.lat ?? null,
        lng: app.lng ?? null,
        hospital_level: typeData.hospital_level ?? "secondary",
        emergency_available: typeData.emergency_available ?? true,
        ambulance_available: typeData.ambulance_available ?? false,
        bed_count: Number.isFinite(bedCount) ? bedCount : null,
        specialties,
        active: true,
      }).select("id").single();
      if (error || !partner) return fail("Could not create hospital partner", error?.message);
      partnerId = partner.id;
    }

    // Any failure from here on undoes everything this request created, so a retry starts clean.
    let staffLinked = false;
    const rollback = async () => {
      if (staffLinked && userId) await admin.from(staff.table).delete().eq("user_id", userId).eq(staff.fk, partnerId);
      await admin.from(partnerTable).delete().eq("id", partnerId);
      if (createdLogin && userId) await admin.auth.admin.deleteUser(userId);
    };

    // 3. Legacy application with no existing login: create one with a temporary password.
    if (!userId) {
      if (!app.email) { await rollback(); return json("This application has no email address to create a login for.", 400); }
      tempPassword = generateTempPassword();
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
        email: String(app.email).trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: app.contact_person_name ?? app.name, facility_type: facilityType, partner_id: partnerId },
      });
      if (authErr || !authUser?.user) {
        await rollback();
        return fail(`Could not create a login for ${app.email}`, authErr?.message);
      }
      userId = authUser.user.id;
      createdLogin = true;
    }

    // 4. Give the login its staff role. (users has no email column in the live DB — don't write one.)
    const { error: userErr } = await admin.from("users").upsert({
      id: userId,
      name: app.contact_person_name ?? app.name,
      phone: app.phone,
      role,
    }, { onConflict: "id", ignoreDuplicates: false });
    if (userErr) {
      await rollback();
      const phoneTaken = /phone/i.test(userErr.message) && /duplicate|unique/i.test(userErr.message);
      return phoneTaken
        ? json(`The phone number ${app.phone} is already used by another StreetdocMD account. Update the application's phone or contact the facility.`, 409)
        : fail("Could not set the account role", userErr.message);
    }

    // 5. Link the login to the partner record. If this login is already linked
    //    (e.g. an earlier attempt), the unique user_id constraint reports it.
    const { error: staffErr } = await admin.from(staff.table).insert({ user_id: userId, [staff.fk]: partnerId });
    if (staffErr) {
      await rollback();
      return /duplicate|unique/i.test(staffErr.message)
        ? json("This login is already linked to another facility, so it can't be linked to this one.", 409)
        : fail("Could not link the account to the facility", staffErr.message);
    }
    staffLinked = true;

    if (reusedLegacyLogin && userId) {
      tempPassword = generateTempPassword();
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        // The partner portal prompts a password change while partner_id is set and password_changed isn't.
        user_metadata: { partner_id: partnerId, facility_type: facilityType, password_changed: false },
      });
      if (pwErr) { await rollback(); return fail("Could not set a temporary password on the existing login", pwErr.message); }
    }

    // 6. Mark approved — only if nobody else approved/rejected it meanwhile.
    const { data: marked, error: appErr } = await admin
      .from("facility_applications")
      .update({
        status: "approved",
        user_id: userId,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .in("status", OPEN_STATUSES)
      .select("id");
    if (appErr || !marked || marked.length === 0) {
      await rollback();
      return appErr
        ? fail("Could not mark the application approved", appErr.message)
        : json("This application was just actioned by someone else. Refresh to see its current status.", 409);
    }

    const login = tempPassword
      ? `Email: ${app.email} Temp password: ${tempPassword} Please change your password on first login.`
      : `Sign in with ${app.email} and the password you created.`;
    const smsSent = await sendSms(
      app.phone,
      `Welcome to StreetdocMD Partner Network! Your facility ${app.name} has been approved. Log in at: ${PORTAL_URLS[facilityType]} ${login}`
    );

    return NextResponse.json({
      ok: true,
      temp_password: tempPassword,
      partner_id: partnerId,
      login_email: app.email,
      portal_url: PORTAL_URLS[facilityType],
      sms_sent: smsSent,
    });
  } catch (err) {
    return json(err instanceof Error ? err.message : "Unexpected server error.", 500);
  }
}
