import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// The only moves pharmacy staff make, keyed by the status they move to.
// (pending_payment -> confirmed is set by the payment webhook, not staff.)
const ALLOWED_FROM: Record<string, string> = {
  pending_payment: "sent",
  cancelled: "sent", // can't supply anything on the prescription
  dispensing: "confirmed",
  dispatched: "dispensing",
  delivered: "dispatched",
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("pharmacy");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const { status, drugPrices, outOfStock, catalogueLinks, riderName, riderPhone, eta } = body;

  const admin = createAdminSupabase();

  // Fetch current order
  const { data: order } = await admin
    .from("prescription_orders")
    .select("id, drugs, status, payment_status, patient_id, provider_id, pharmacy_partner_id, prescription_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!order || !ownsRecord(auth.access, order.pharmacy_partner_id)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // "confirmed" is set exclusively by the Paystack webhook once payment clears —
  // pharmacy staff cannot set it directly, and fulfillment (dispensing/dispatch)
  // can only proceed once payment_status is actually "paid".
  if (status === "confirmed") {
    return NextResponse.json({ error: "Order is confirmed automatically once payment is received" }, { status: 403 });
  }
  if (!ALLOWED_FROM[status]) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (order.status !== ALLOWED_FROM[status]) {
    return NextResponse.json({ error: "This order has already moved on. Refresh the page to see its latest status." }, { status: 409 });
  }
  if (["dispensing", "dispatched"].includes(status) && order.payment_status !== "paid") {
    return NextResponse.json({ error: "Order is not paid yet" }, { status: 403 });
  }
  if (status === "pending_payment" && !drugPrices) {
    return NextResponse.json({ error: "Enter prices before sending the order to the patient." }, { status: 400 });
  }
  if (status === "dispatched" && (!String(riderName ?? "").trim() || !String(riderPhone ?? "").trim())) {
    return NextResponse.json({ error: "Enter the rider's name and phone number before dispatching." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };

  // Pricing step: update drug prices, calculate total, and hand off to payment —
  // status becomes pending_payment; the webhook moves it to confirmed once the
  // patient actually pays.
  if (status === "pending_payment" && drugPrices) {
    // Only trust a catalogue_id if it actually belongs to this order's own
    // fulfilling pharmacy — the client only ever sees its own catalogue in
    // the dropdown, but this request could still be tampered with, and
    // this route runs on the service-role client (bypasses RLS).
    const linkedIds = Object.values(catalogueLinks ?? {}) as string[];
    let validCatalogueIds = new Set<string>();
    if (linkedIds.length > 0) {
      const { data: ownCatalogue } = await admin
        .from("drug_catalogue")
        .select("id")
        .eq("pharmacy_partner_id", order.pharmacy_partner_id)
        .in("id", linkedIds);
      validCatalogueIds = new Set((ownCatalogue ?? []).map(c => c.id));
    }

    const updatedDrugs = (order.drugs as any[]).map((drug: any, i: number) => {
      if ((outOfStock as number[] ?? []).includes(i)) return { ...drug, out_of_stock: true, price: 0 };
      const linkedId = (catalogueLinks ?? {})[i];
      return {
        ...drug,
        price: Math.max(0, Number(drugPrices[i]) || 0),
        catalogue_id: linkedId && validCatalogueIds.has(linkedId) ? linkedId : (drug.catalogue_id ?? null),
      };
    });
    const total = updatedDrugs.reduce((sum: number, d: any) => sum + (d.price ?? 0), 0);
    if (!(total > 0)) {
      return NextResponse.json({ error: "Enter a price for at least one medication." }, { status: 400 });
    }
    const commission = Math.round(total * 0.08);
    updates.drugs           = updatedDrugs;
    updates.total_amount    = total;
    updates.commission_amount = commission;
  }

  // Dispensing is the point stock is physically pulled — the only point
  // payment is guaranteed to have cleared (checked above) and the only
  // manual step in the flow that represents committing inventory.
  if (status === "dispensing") {
    for (const drug of (order.drugs as any[]) ?? []) {
      if (!drug.catalogue_id || drug.out_of_stock) continue;
      const { data: item } = await admin
        .from("drug_catalogue")
        .select("stock_quantity")
        .eq("id", drug.catalogue_id)
        .single();
      if (!item) continue;
      const newStock = Math.max(0, item.stock_quantity - (drug.quantity ?? 1));
      await admin.from("drug_catalogue").update({
        stock_quantity: newStock,
        in_stock: newStock > 0,
        updated_at: new Date().toISOString(),
      }).eq("id", drug.catalogue_id);
    }
  }

  const { error } = await admin.from("prescription_orders").update(updates).eq("id", params.id).eq("status", order.status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Back to the patient, who can try another pharmacy
  if (status === "cancelled" && order.prescription_id) {
    await admin.from("prescriptions").update({ patient_reviewed_at: null }).eq("id", order.prescription_id);
  }

  // When dispatching: create/update delivery_tracking row
  if (status === "dispatched" && riderName && riderPhone) {
    const { data: existing } = await admin
      .from("delivery_tracking")
      .select("id")
      .eq("prescription_order_id", params.id)
      .maybeSingle();

    const trackingPayload = {
      rider_name:           riderName,
      rider_phone:          riderPhone,
      dispatched_at:        new Date().toISOString(),
      estimated_arrival:    eta ?? null,
    };

    if (existing) {
      await admin.from("delivery_tracking").update(trackingPayload).eq("id", existing.id);
    } else {
      await admin.from("delivery_tracking").insert({
        prescription_order_id: params.id,
        ...trackingPayload,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
