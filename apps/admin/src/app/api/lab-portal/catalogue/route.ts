import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { sharedTestId } from "@/lib/lab-tests";

export const dynamic = "force-dynamic";

// A lab adds a test to its own menu (investigation_catalogue, scope lab_partner).
// Lab staff have no direct write access to the catalogue under RLS, so this
// runs on the service role and always writes the caller's own lab_partner_id.
export async function POST(req: NextRequest) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Only a lab's own staff can edit its test menu." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const testName = String(body.test_name ?? "").trim();
  const price = Number(body.price);
  const turnaround = body.turnaround_hours === "" || body.turnaround_hours == null ? null : Number(body.turnaround_hours);

  if (!testName) return NextResponse.json({ error: "Enter the test name." }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Enter a price greater than ₦0." }, { status: 400 });
  if (turnaround !== null && (!Number.isInteger(turnaround) || turnaround <= 0)) {
    return NextResponse.json({ error: "Turnaround must be a whole number of hours." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const platformTestId = await sharedTestId(admin, testName, body.same_as);
  if (!platformTestId) return NextResponse.json({ error: "Couldn't save the test. Please try again." }, { status: 500 });

  const { data, error } = await admin
    .from("investigation_catalogue")
    .insert({
      platform_test_id: platformTestId,
      lab_partner_id: partnerId,
      scope: "lab_partner",
      test_name: testName.slice(0, 200),
      test_code: String(body.test_code ?? "").trim() || null,
      price,
      turnaround_hours: turnaround,
      sample_type: String(body.sample_type ?? "").trim() || null,
      home_collection: Boolean(body.home_collection),
      preparation: String(body.preparation ?? "").trim().slice(0, 500) || null,
      active: body.active === undefined ? true : Boolean(body.active),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
