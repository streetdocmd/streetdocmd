import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// A lab test can be linked to one active StreetdocMD (platform) test, which is
// how orders are matched to labs (migration 067)
async function validPlatformTest(admin: ReturnType<typeof createAdminSupabase>, id: unknown): Promise<string | null | false> {
  if (id == null || id === "") return null;
  if (typeof id !== "string") return false;
  const { data } = await admin.from("investigation_catalogue").select("id").eq("id", id).eq("scope", "platform").maybeSingle();
  return data ? data.id : false;
}


// Update a test on the caller's own menu. A price change is dated (price_updated_at).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Only a lab's own staff can edit its test menu." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if ("price" in body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Enter a price greater than ₦0." }, { status: 400 });
    patch.price = price;
    patch.price_updated_at = new Date().toISOString();
  }
  if ("test_name" in body) {
    const name = String(body.test_name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Enter the test name." }, { status: 400 });
    patch.test_name = name.slice(0, 200);
  }
  if ("sample_type" in body) patch.sample_type = String(body.sample_type ?? "").trim() || null;
  if ("test_code" in body) patch.test_code = String(body.test_code ?? "").trim() || null;
  if ("platform_test_id" in body) {
    const platformTestId = await validPlatformTest(createAdminSupabase(), body.platform_test_id);
    if (platformTestId === false) return NextResponse.json({ error: "Choose a StreetdocMD test from the list." }, { status: 400 });
    patch.platform_test_id = platformTestId;
  }
  if ("preparation" in body) patch.preparation = String(body.preparation ?? "").trim().slice(0, 500) || null;
  if ("turnaround_hours" in body) {
    const t = body.turnaround_hours === "" || body.turnaround_hours == null ? null : Number(body.turnaround_hours);
    if (t !== null && (!Number.isInteger(t) || t <= 0)) return NextResponse.json({ error: "Turnaround must be a whole number of hours." }, { status: 400 });
    patch.turnaround_hours = t;
  }
  if ("active" in body) patch.active = Boolean(body.active);
  if ("home_collection" in body) patch.home_collection = Boolean(body.home_collection);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await createAdminSupabase()
    .from("investigation_catalogue")
    .update(patch)
    .eq("id", params.id)
    .eq("lab_partner_id", partnerId) // only ever this lab's own rows
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Test not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
