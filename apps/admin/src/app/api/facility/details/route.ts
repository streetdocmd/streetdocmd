import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { PORTALS, type PortalType } from "@/components/portal/config";

export const dynamic = "force-dynamic";

// A facility edits the details patients see on its profile (migration 058):
// opening hours for all, delivery time for pharmacies, services for hospitals.
// Always writes the caller's own facility row.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = body.type as PortalType;
  if (!(type in PORTALS)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const auth = await getPortalApiAccess(type);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Only a facility's own staff can edit its profile." }, { status: 403 });

  const patch: Record<string, unknown> = {
    opening_hours: String(body.opening_hours ?? "").trim().slice(0, 120) || null,
  };

  if (type === "pharmacy") {
    const eta = body.delivery_eta_minutes === "" || body.delivery_eta_minutes == null ? null : Number(body.delivery_eta_minutes);
    if (eta !== null && (!Number.isInteger(eta) || eta <= 0 || eta > 1440)) {
      return NextResponse.json({ error: "Delivery time must be a whole number of minutes." }, { status: 400 });
    }
    patch.delivery_eta_minutes = eta;
  }

  // Location: patients are matched to facilities by distance
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = body.lat === "" || body.lat == null ? null : Number(body.lat);
    const lng = body.lng === "" || body.lng == null ? null : Number(body.lng);
    if ((lat == null) !== (lng == null)) return NextResponse.json({ error: "Enter both latitude and longitude." }, { status: 400 });
    if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng!) || lng! < -180 || lng! > 180)) {
      return NextResponse.json({ error: "Enter a valid location." }, { status: 400 });
    }
    patch.lat = lat;
    patch.lng = lng;
  }

  if (type === "lab") {
    // Matching (migration 067): labs outside their radius, or not collecting at
    // home, aren't offered home collection orders. The fee is shown to patients.
    const fee = Number(body.home_collection_fee ?? 0);
    const radius = Number(body.service_radius_km ?? 25);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100000) return NextResponse.json({ error: "Enter a valid collection fee." }, { status: 400 });
    if (!Number.isFinite(radius) || radius < 1 || radius > 200) return NextResponse.json({ error: "Service area must be between 1 and 200 km." }, { status: 400 });
    patch.home_collection_available = body.home_collection_available !== false;
    patch.home_collection_fee = Math.round(fee);
    patch.service_radius_km = Math.round(radius);
  }

  if (type === "hospital") {
    const list: unknown[] = Array.isArray(body.services) ? body.services : [];
    patch.services = Array.from(new Set(
      list.map(s => String(s ?? "").trim().slice(0, 60)).filter(Boolean),
    )).slice(0, 40);
  }

  const { error } = await createAdminSupabase()
    .from(PORTALS[type].partnerTable)
    .update(patch)
    .eq("id", partnerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
