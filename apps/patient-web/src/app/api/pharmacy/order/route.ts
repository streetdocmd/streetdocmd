import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { nearestPartner } from "@/lib/proximity";

const PLATFORM_COMMISSION_RATE = 0.08; // matches the rate already used when pharmacy staff price a provider-prescribed order

interface RequestedItem {
  catalogue_id: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { items, patient_lat, patient_lng, patient_address } = await req.json();

    if (patient_lat == null || patient_lng == null || !patient_address) {
      return NextResponse.json({ error: "Missing delivery address" }, { status: 400 });
    }
    const requested = (items as RequestedItem[] | undefined)?.filter(i => i?.catalogue_id && i.quantity > 0) ?? [];
    if (requested.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    const { data: partners } = await admin
      .from("pharmacy_partners")
      .select("id, name, lat, lng")
      .eq("active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);

    const pharmacy = nearestPartner(partners ?? [], patient_lat, patient_lng);
    if (!pharmacy) return NextResponse.json({ error: "No pharmacy currently available in your area" }, { status: 404 });

    // Fee is never trusted from the client — re-fetch each item from this
    // pharmacy's own catalogue and price/validate stock server-side, same
    // trust boundary used for lab_test_selection (037_preferred_provider_by_code
    // era work) and every other booking-creation path in this codebase.
    const catalogueIds = requested.map(i => i.catalogue_id);
    const { data: catalogueItems } = await admin
      .from("drug_catalogue")
      .select("id, drug_name, generic_name, formulation, strength, price, stock_quantity")
      .eq("pharmacy_partner_id", pharmacy.id)
      .eq("active", true)
      .eq("in_stock", true)
      .eq("prescription_required", false)
      .in("id", catalogueIds);

    const byId = new Map((catalogueItems ?? []).map(c => [c.id, c]));

    const drugs: any[] = [];
    for (const r of requested) {
      const item = byId.get(r.catalogue_id);
      if (!item) {
        return NextResponse.json({ error: `One of the selected items is no longer available` }, { status: 400 });
      }
      if (item.stock_quantity < r.quantity) {
        return NextResponse.json({ error: `Only ${item.stock_quantity} of ${item.drug_name} left in stock` }, { status: 400 });
      }
      drugs.push({
        catalogue_id: item.id,
        drug_name: item.drug_name,
        generic_name: item.generic_name,
        formulation: item.formulation,
        strength: item.strength,
        quantity: r.quantity,
        price: item.price * r.quantity,
      });
    }

    const total = drugs.reduce((sum, d) => sum + d.price, 0);
    const commission = Math.round(total * PLATFORM_COMMISSION_RATE);

    const { data: order, error } = await admin
      .from("prescription_orders")
      .insert({
        patient_id: user.id,
        provider_id: null,
        requested_by: "patient",
        pharmacy_partner_id: pharmacy.id,
        drugs,
        status: "pending_payment",
        payment_status: "pending",
        total_amount: total,
        commission_amount: commission,
      })
      .select("id")
      .single();

    if (error || !order) {
      return NextResponse.json({ error: error?.message ?? "Failed to create order" }, { status: 500 });
    }

    return NextResponse.json({ order_id: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
