import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId  = searchParams.get("orderId");
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  if (!orderId) return NextResponse.redirect(new URL("/dashboard", req.url));

  const admin = createAdminSupabase();

  // Verify with Paystack
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const { data } = await verifyRes.json();

  if (data?.status === "success") {
    await admin.from("prescription_orders").update({
      payment_status: "paid",
      status:         "sent",
    }).eq("id", orderId);
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
