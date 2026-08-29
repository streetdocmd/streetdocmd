import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_PRICES, ELDERLY_FOLLOW_UP_SERVICE, calculateCommission, calculateNetPayout } from "@streetdocmd/shared";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bookingId } = await req.json();
    if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

    const fee = SERVICE_PRICES[ELDERLY_FOLLOW_UP_SERVICE];
    const commission = calculateCommission(fee);
    const net_payout = calculateNetPayout(fee);

    // create_elderly_follow_up_booking() (023_service_specialty_dispatch.sql)
    // verifies via auth.uid() that the caller is the provider who saw this
    // patient, and that the original booking is an elderly_review visit.
    const { data: newBookingId, error } = await supabase.rpc("create_elderly_follow_up_booking", {
      p_original_booking_id: bookingId,
      p_fee: fee,
      p_commission: commission,
      p_net_payout: net_payout,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ booking_id: newBookingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
