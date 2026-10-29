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
    .select("*") // opening_hours and delivery_eta_minutes arrive with migration 058
    .eq("active", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  const pharmacy = nearestPartner((partners ?? []) as any[], lat, lng) as any;
  if (!pharmacy) return NextResponse.json({ error: "No pharmacy currently available in your area" }, { status: 404 });

  // prescription_required items are deliberately excluded from this
  // self-service list — a patient hasn't seen a provider or uploaded a
  // prescription in this flow, so anything gated behind one stays
  // reachable only via the existing provider-prescribed order path.
  // Out of stock items are listed too (the design shows them, disabled).
  const { data: rows } = await admin
    .from("drug_catalogue")
    .select("*")
    .eq("pharmacy_partner_id", pharmacy.id)
    .eq("active", true)
    .eq("prescription_required", false)
    .order("drug_name");

  const items = ((rows ?? []) as any[]).map(r => {
    const qty = Number(r.stock_quantity ?? 0);
    const threshold = Number(r.low_stock_threshold ?? 10);
    const stock = !r.in_stock || qty <= 0 ? "out" : qty <= threshold ? "low" : "in";
    return {
      id: r.id, drug_name: r.drug_name, generic_name: r.generic_name, formulation: r.formulation,
      strength: r.strength, price: r.price, stock, stock_left: stock === "low" ? qty : null,
      image_url: r.image_url ?? null,
    };
  });

  return NextResponse.json({
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      address: pharmacy.address ?? null,
      opening_hours: pharmacy.opening_hours ?? null,
      logo_url: pharmacy.logo_url ?? null,
      delivery_eta_minutes: pharmacy.delivery_eta_minutes ?? null,
      rating: pharmacy.rating ?? null,
      review_count: pharmacy.review_count ?? 0,
    },
    items,
  });
}
