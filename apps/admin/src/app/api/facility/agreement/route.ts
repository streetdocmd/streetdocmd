import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { FACILITY_AGREEMENT_VERSION } from "@/lib/facility-agreement";

export const dynamic = "force-dynamic";

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * POST — the signed-in facility's authorised representative accepts the
 * current Facility Partner Platform Service Agreement. For facilities that
 * registered before acceptance was captured at sign-up, or that accepted an
 * older version.
 *
 * Body: { accepted: true, version: string, name: string }
 *
 * The application is always the caller's own latest one, resolved from the
 * user id Supabase Auth verified from the session (never from the body). The
 * acceptance time is the server's clock.
 */
export async function POST(req: NextRequest) {
  const { data: { user } } = await createServerSupabase().auth.getUser();
  if (!user) return json("Your session has expired. Please sign in again.", 401);

  const body = await req.json().catch(() => null);
  if (!body || body.accepted !== true) {
    return json("Tick the box to confirm you are authorised to bind the facility and agree to the Agreement.", 400);
  }
  if (String(body.version ?? "") !== FACILITY_AGREEMENT_VERSION) {
    return json("The Facility Partner Agreement has been updated since you opened this page. Please refresh the page, review the latest version and accept again.", 409);
  }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 200) : "";
  if (name.length < 2) return json("Enter the full name of the authorised representative accepting the Agreement.", 400);

  const admin = createAdminSupabase();
  const { data: app, error } = await admin
    .from("facility_applications")
    .select("id, status, agreement_version, agreement_accepted_at, agreement_accepted_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      /agreement_/i.test(error.message)
        ? "facility agreement accept: agreement columns missing — apply migration 054_facility_agreement_acceptance.sql:"
        : "facility agreement accept: load failed:",
      error
    );
    return json("We couldn't record your acceptance right now. Please try again, or email contact@streetdocmd.com.", 500);
  }
  if (!app) return json("We couldn't find a facility registration for this account.", 404);
  if (app.status === "rejected") {
    return json("This application wasn't approved. Re-apply first — you'll accept the Agreement as part of the new application.", 409);
  }

  // Already accepted this version: keep the original record (and its timestamp).
  if (app.agreement_accepted_at && app.agreement_version === FACILITY_AGREEMENT_VERSION) {
    return NextResponse.json({
      version: app.agreement_version,
      accepted_at: app.agreement_accepted_at,
      accepted_name: app.agreement_accepted_name,
      already_accepted: true,
    });
  }

  const acceptedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("facility_applications")
    .update({
      agreement_version: FACILITY_AGREEMENT_VERSION,
      agreement_accepted_at: acceptedAt,
      agreement_accepted_by: user.id,
      agreement_accepted_name: name,
    })
    .eq("id", app.id)
    .eq("user_id", user.id);
  if (updErr) {
    console.error("facility agreement accept: update failed:", updErr);
    return json("We couldn't record your acceptance right now. Please try again, or email contact@streetdocmd.com.", 500);
  }

  return NextResponse.json({ version: FACILITY_AGREEMENT_VERSION, accepted_at: acceptedAt, accepted_name: name });
}
