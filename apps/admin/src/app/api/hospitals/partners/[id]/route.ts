import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

// Fields an admin may edit on a hospital partner.
const EDITABLE = [
  "name", "address", "phone", "email", "lat", "lng", "hospital_level",
  "emergency_available", "ambulance_available", "bed_count", "specialties", "active",
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.includes(k)));
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const admin = createAdminSupabase();
  const { error } = await admin.from("hospital_partners").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
