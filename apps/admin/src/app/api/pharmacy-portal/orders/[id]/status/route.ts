import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["pharmacy_staff", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, drugPrices, outOfStock, catalogueLinks, riderName, riderPhone, eta } = body;

  const admin = createAdminSupabase();

  // Fetch current order
  const { data: order } = await admin
    .from("prescription_orders")
    .select("id, drugs, status, payment_status, patient_id, provider_id, pharmacy_partner_id")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // "confirmed" is set exclusively by the Paystack webhook once payment clears —
  // pharmacy staff cannot set it directly, and fulfillment (dispensing/dispatch)
  // can only proceed once payment_status is actually "paid".
  if (status === "confirmed") {
    return NextResponse.json({ error: "Order is confirmed automatically once payment is received" }, { status: 403 });
  }
  if (["dispensing", "dispatched"].includes(status) && order.payment_status !== "paid") {
    return NextResponse.json({ error: "Order is not paid yet" }, { status: 403 });
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
        price: drugPrices[i] ?? 0,
        catalogue_id: linkedId && validCatalogueIds.has(linkedId) ? linkedId : (drug.catalogue_id ?? null),
      };
    });
    const total = updatedDrugs.reduce((sum: number, d: any) => sum + (d.price ?? 0), 0);
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

  const { error } = await admin.from("prescription_orders").update(updates).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When dispatching: create/update delivery_tracking row
  if (status === "dispatched" && riderName && riderPhone) {
    const { data: existing } = await admin
      .from("delivery_tracking")
      .select("id")
      .eq("prescription_order_id", params.id)
      .single();

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

    // Notify patient
    await notifyUser(admin, order.patient_id, "Your medication is on the way! 🛵", `Rider: ${riderName} (${riderPhone})`);
  }

  return NextResponse.json({ ok: true });
}

async function notifyUser(admin: any, userId: string, title: string, body: string) {
  const { data: u } = await admin.from("users").select("push_token").eq("id", userId).single();
  const token = u?.push_token;
  if (!token?.startsWith("ExponentPushToken")) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  }).catch(() => {});
}
