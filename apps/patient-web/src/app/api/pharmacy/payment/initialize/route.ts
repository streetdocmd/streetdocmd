import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json();
  const { orderId, userId } = body;

  // Support both cookie-auth (web) and userId param (native app)
  const effectiveUserId = user?.id ?? userId;
  if (!effectiveUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();

  const { data: order } = await admin
    .from("prescription_orders")
    .select("id, patient_id, total_amount, payment_status")
    .eq("id", orderId)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.patient_id !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });
  if (!order.total_amount || order.total_amount <= 0) {
    return NextResponse.json({ error: "Order total not set yet — wait for pharmacy confirmation" }, { status: 400 });
  }

  // Get patient email for Paystack
  const { data: patient } = await admin.from("users").select("email").eq("id", effectiveUserId).single();

  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKey) return NextResponse.json({ error: "Payment not configured" }, { status: 500 });

  const ref = `rx_${orderId}_${Date.now()}`;
  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email:        patient?.email ?? `patient+${effectiveUserId}@streetdocmd.com`,
      amount:       Math.round(order.total_amount * 100), // kobo
      reference:    ref,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.streetdocmd.com"}/api/pharmacy/payment/verify?orderId=${orderId}`,
      metadata:     { order_id: orderId, type: "prescription_order" },
    }),
  });

  const { data: psData, status: psStatus } = await paystackRes.json();
  if (psStatus !== true && !psData?.authorization_url) {
    return NextResponse.json({ error: "Payment initialization failed" }, { status: 500 });
  }

  // Save reference so webhook can match it
  await admin.from("prescription_orders").update({ payment_reference: ref }).eq("id", orderId);

  return NextResponse.json({ authorization_url: psData.authorization_url, reference: ref });
}
