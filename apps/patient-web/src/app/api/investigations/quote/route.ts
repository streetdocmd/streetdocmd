import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { quoteTests } from "@/lib/investigations";

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
    .select("id, patient_id, tests, collection_method")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const ids = ((order.tests as any[]) ?? []).map(t => t?.platform_test_id).filter(Boolean);
  try {
    const quote = await quoteTests(admin, ids, lat, lng, order.collection_method === "doctor" ? "doctor" : "home");
    if (!quote) {
      return NextResponse.json({
        error: "No partner lab can do all of these tests at this address yet. Try another address, or remove a test.",
        code: "no_lab",
      }, { status: 409 });
    }
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json({ error: "Couldn't work out the price. Please try again." }, { status: 500 });
  }
}
