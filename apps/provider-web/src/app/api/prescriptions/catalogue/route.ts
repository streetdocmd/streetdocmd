import { NextRequest, NextResponse } from "next/server";
import { doctorVisit } from "@/lib/investigation-access";
import { haversineKm } from "@/lib/proximity";

const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// GET /api/prescriptions/catalogue?bookingId=: medicines a doctor can search
// when prescribing: the medication library plus everything partner pharmacies
// list, with how many pharmacies near this visit have each in stock. It's a
// guide only. A prescription can name anything, and no pharmacy is chosen here:
// the patient reviews the list before one is involved.
export async function GET(req: NextRequest) {
  const v = await doctorVisit(req.nextUrl.searchParams.get("bookingId"));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });
  const { admin, booking } = v;

  const [{ data: library }, { data: stock }, { data: pharmacies }] = await Promise.all([
    admin.from("medication_library").select("name, generic_name, formulation, strength").eq("active", true).order("name"),
    admin.from("drug_catalogue").select("drug_name, generic_name, formulation, strength, pharmacy_partner_id")
      .eq("active", true).eq("in_stock", true),
    admin.from("pharmacy_partners").select("id, lat, lng, delivery_radius_km").eq("active", true),
  ]);

  const lat = booking.patient_lat, lng = booking.patient_lng;
  const near = new Set(((pharmacies ?? []) as any[]).filter(p =>
    lat == null || lng == null || p.lat == null || p.lng == null || !p.delivery_radius_km
    || haversineKm(lat, lng, p.lat, p.lng) <= p.delivery_radius_km).map(p => p.id));

  const stockedBy = new Map<string, Set<string>>();
  const medicines = new Map<string, any>();
  const idOf = (m: any) => [m.name, m.strength, m.formulation].map(key).join("|");

  for (const m of (library ?? []) as any[]) medicines.set(idOf(m), { ...m, pharmacies: 0 });
  for (const s of (stock ?? []) as any[]) {
    const m = { name: s.drug_name, generic_name: s.generic_name, formulation: s.formulation, strength: s.strength };
    if (!medicines.has(idOf(m))) medicines.set(idOf(m), { ...m, pharmacies: 0 });
    if (near.has(s.pharmacy_partner_id)) {
      for (const k of [key(s.drug_name), key(s.generic_name)].filter(Boolean)) {
        stockedBy.set(k, (stockedBy.get(k) ?? new Set()).add(s.pharmacy_partner_id));
      }
    }
  }

  return NextResponse.json({
    medicines: Array.from(medicines.values()).map(m => ({
      ...m,
      pharmacies: new Set([...(stockedBy.get(key(m.name)) ?? []), ...(stockedBy.get(key(m.generic_name)) ?? [])]).size,
    })),
  });
}
