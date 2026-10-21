import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// Update price / turnaround / availability of a test on the caller's own menu.
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
  }
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
