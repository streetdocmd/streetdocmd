import { NextRequest, NextResponse } from "next/server";
import { doctorVisit } from "@/lib/investigation-access";

// GET /api/investigations/catalogue?bookingId=: every test on the shared list,
// with its other names and each lab that serves this visit's address and
// offers it, with its price (migration 074). The visit note only lets a doctor
// order a test from a lab that offers it.
export async function GET(req: NextRequest) {
  const v = await doctorVisit(req.nextUrl.searchParams.get("bookingId"));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });

  const { data: tests } = await v.admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, sample_type, turnaround_hours")
    .eq("scope", "platform").eq("active", true).order("test_name");
  const list = (tests ?? []) as any[];
  const { data: aliases } = await v.admin.from("investigation_test_aliases").select("platform_test_id, alias");
  const names = new Map<string, string[]>();
  for (const a of (aliases ?? []) as any[]) names.set(a.platform_test_id, [...(names.get(a.platform_test_id) ?? []), a.alias]);

  const args = { p_test_ids: list.map(t => t.id), p_lat: v.booking.patient_lat, p_lng: v.booking.patient_lng };
  const [{ data: home }, { data: doctor }] = await Promise.all([
    v.admin.rpc("investigation_offers", { ...args, p_collection: "home" }),
    v.admin.rpc("investigation_offers", { ...args, p_collection: "doctor" }),
  ]);
  const byTest = (rows: unknown) => {
    const m = new Map<string, any[]>();
    for (const o of (rows ?? []) as any[]) {
      m.set(o.platform_test_id, [...(m.get(o.platform_test_id) ?? []), {
        lab_id: o.lab_partner_id, lab_name: o.lab_name, price: Number(o.price),
        km: Math.round(Number(o.distance_km) * 10) / 10, rating: Number(o.rating ?? 0),
      }]);
    }
    return m;
  };
  const offersHome = byTest(home), offersDoctor = byTest(doctor);

  return NextResponse.json({
    tests: list.map(t => ({
      ...t,
      aliases: names.get(t.id) ?? [],
      offers_home: offersHome.get(t.id) ?? [],
      offers_doctor: offersDoctor.get(t.id) ?? [],
    })),
  });
}
