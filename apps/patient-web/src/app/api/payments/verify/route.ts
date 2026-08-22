import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

// Read-only status check for the patient's UI. The Paystack webhook
// (admin/api/payments/webhook) is the only thing authorized to mark a
// booking as paid — this endpoint never writes.
export async function POST(req: NextRequest) {
  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("status, payment_status, patient_id")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.patient_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ status: booking.status, payment_status: booking.payment_status });
}
