import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// Ward capacity (hospital_ward_capacity, migration 058). Writes are scoped to the
// signed-in staff member's own hospital; admins have no hospital of their own here.
async function hospitalId() {
  const auth = await getPortalApiAccess("hospital");
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (!auth.access.partnerId) {
    return { error: NextResponse.json({ error: "Capacity is updated by the hospital's own staff." }, { status: 403 }) };
  }
  return { id: auth.access.partnerId };
}

const asCount = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 5000 ? (v as number) : null);

export async function POST(req: NextRequest) {
  const h = await hospitalId();
  if ("error" in h) return h.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.ward_name === "string" ? body.ward_name.trim().slice(0, 60) : "";
  const total = asCount(body.total_beds);
  if (!name || total == null) return NextResponse.json({ error: "Enter a ward name and the number of beds." }, { status: 400 });

  const { data, error } = await createAdminSupabase()
    .from("hospital_ward_capacity")
    .insert({ hospital_partner_id: h.id, ward_name: name, total_beds: total, free_beds: total })
    .select("id, ward_name, total_beds, free_beds, updated_at")
    .single();
  if (error) {
    const msg = error.code === "23505" ? "You already have a ward with this name." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ ward: data });
}

export async function PATCH(req: NextRequest) {
  const h = await hospitalId();
  if ("error" in h) return h.error;

  const body = await req.json().catch(() => ({}));
  const free = asCount(body.free_beds);
  if (typeof body.id !== "string" || free == null) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const { data, error } = await createAdminSupabase()
    .from("hospital_ward_capacity")
    .update({ free_beds: free, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("hospital_partner_id", h.id)
    .select("id, ward_name, total_beds, free_beds, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.code === "23514" ? "Free beds can't be more than total beds." : error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Ward not found" }, { status: 404 });
  return NextResponse.json({ ward: data });
}

export async function DELETE(req: NextRequest) {
  const h = await hospitalId();
  if ("error" in h) return h.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { error } = await createAdminSupabase()
    .from("hospital_ward_capacity")
    .delete()
    .eq("id", id)
    .eq("hospital_partner_id", h.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
