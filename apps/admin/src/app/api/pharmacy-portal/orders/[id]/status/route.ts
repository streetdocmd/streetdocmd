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
  const { status, drugPrices, outOfStock, riderName, riderPhone, eta } = body;

  const admin = createAdminSupabase();

  // Fetch current order
  const { data: order } = await admin
    .from("prescription_orders")
    .select("id, drugs, status, patient_id, provider_id")
    .eq("id", params.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const updates: Record<string, unknown> = { status };

  // When confirming: update drug prices and calculate total
  if (status === "confirmed" && drugPrices) {
    const updatedDrugs = (order.drugs as any[]).map((drug: any, i: number) => {
      if ((outOfStock as number[] ?? []).includes(i)) return { ...drug, out_of_stock: true, price: 0 };
      return { ...drug, price: drugPrices[i] ?? 0 };
    });
    const total = updatedDrugs.reduce((sum: number, d: any) => sum + (d.price ?? 0), 0);
    const commission = Math.round(total * 0.08);
    updates.drugs          = updatedDrugs;
    updates.total_amount   = total;
    updates.commission_amount = commission;
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
