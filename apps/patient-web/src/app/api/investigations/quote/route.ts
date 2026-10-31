import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { missingMessage, orderTestIds, quoteTests } from "@/lib/investigations";

// POST /api/investigations/quote { orderId, lat, lng }: the best lab and the
// itemised price for one of the patient's own orders at this address.
// Read only; checkout recalculates before taking payment.
export async function POST(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat), lng = Number(body.lng);
  if (typeof body.orderId !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Choose the collection address first." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, patient_id, tests, collection_method, group_id")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  try {
    const { ids, preferred } = await orderTestIds(admin, order);
    const { quote, missing } = await quoteTests(admin, ids, lat, lng, order.collection_method === "doctor" ? "doctor" : "home", preferred);
    if (!quote) {
      return NextResponse.json({ error: missingMessage(missing), code: "no_lab", missing }, { status: 409 });
    }
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json({ error: "Couldn't work out the price. Please try again." }, { status: 500 });
  }
}
