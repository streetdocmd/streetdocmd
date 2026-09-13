import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { nearestPartner } from "@/lib/proximity";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Missing or invalid lat/lng" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: partners } = await admin
    .from("pharmacy_partners")
    .select("id, name, lat, lng")
    .eq("active", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  const pharmacy = nearestPartner(partners ?? [], lat, lng);
  if (!pharmacy) return NextResponse.json({ error: "No pharmacy currently available in your area" }, { status: 404 });

  // prescription_required items are deliberately excluded from this
  // self-service list — a patient hasn't seen a provider or uploaded a
  // prescription in this flow, so anything gated behind one stays
  // reachable only via the existing provider-prescribed order path.
  const { data: items } = await admin
    .from("drug_catalogue")
    .select("id, drug_name, generic_name, formulation, strength, price")
    .eq("pharmacy_partner_id", pharmacy.id)
    .eq("active", true)
    .eq("in_stock", true)
    .eq("prescription_required", false)
    .gt("stock_quantity", 0)
    .order("drug_name");

  return NextResponse.json({
    pharmacy: { id: pharmacy.id, name: pharmacy.name },
    items: items ?? [],
  });
}
