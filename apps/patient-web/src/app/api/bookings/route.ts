import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_PRICES } from "@streetdocmd/shared";
import type { ServiceType } from "@streetdocmd/shared";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { service_type, patient_lat, patient_lng, patient_address, notes } = await req.json();

  if (!service_type || patient_lat == null || patient_lng == null || !patient_address) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fee = SERVICE_PRICES[service_type as ServiceType];
  if (!fee) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

  const commission = Math.round(fee * 0.2);

  const admin = createAdminSupabase();
  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      patient_id: user.id,
      service_type,
      patient_lat,
      patient_lng,
      patient_address,
      notes: notes ?? null,
      fee,
      commission,
      net_payout: fee - commission,
      status: "pending",
      payment_status: "pending",
      // provider_id intentionally omitted — initial_booking_dispatch trigger assigns it
    })
    .select("id")
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: error?.message ?? "Failed to create booking" }, { status: 500 });
  }

  return NextResponse.json({ booking_id: booking.id });
}