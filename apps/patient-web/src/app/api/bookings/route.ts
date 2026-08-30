import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_PRICES, SERVICE_PROFESSION } from "@/lib/shared";
import type { ServiceType, Profession } from "@/lib/shared";

// A follow-up books the same way any other visit does — same profession,
// same booking mechanics — the only differences are the discounted price
// and preferred_provider_id (continuity). No separate service_type per
// follow-up type; "home visit vs virtual vs lab review vs clinical
// review" describes the follow-up's *intent*, not a different pricing
// bucket to dispatch on.
const FOLLOW_UP_SERVICE_TYPE: Record<Profession, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_session",
  lab_scientist: "general_consultation", // no self-registered lab_scientist booking path exists yet
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { patient_lat, patient_lng, patient_address, notes, care_episode_id, follow_up_id } = body;
    let { service_type } = body;

    if (patient_lat == null || patient_lng == null || !patient_address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Optional link to an existing care episode (e.g. "book a follow-up"
    // from the patient's My Care page) — only accepted if it's actually
    // this patient's own episode, checked via their own RLS-scoped
    // session rather than trusting the client-sent id outright.
    let careEpisodeId: string | null = null;
    if (care_episode_id) {
      const { data: episode } = await supabase
        .from("care_episodes")
        .select("id")
        .eq("id", care_episode_id)
        .eq("patient_id", user.id)
        .maybeSingle();
      careEpisodeId = episode?.id ?? null;
    }

    // Booking a specific pending follow-up ("Continue your care with Dr.
    // X" / "Book follow-up") — resolves the service type, episode, and
    // preferred provider from the follow-up record itself rather than
    // trusting whatever the client sends for those.
    let isFollowUp = false;
    let preferredProviderId: string | null = null;
    let resolvedFollowUpId: string | null = null;

    if (follow_up_id) {
      const { data: followUp } = await supabase
        .from("follow_ups")
        .select("id, care_episode_id, continuing_provider_id, status")
        .eq("id", follow_up_id)
        .eq("patient_id", user.id)
        .maybeSingle();

      if (followUp && followUp.status === "scheduled") {
        isFollowUp = true;
        resolvedFollowUpId = followUp.id;
        careEpisodeId = followUp.care_episode_id;
        preferredProviderId = followUp.continuing_provider_id;

        if (preferredProviderId) {
          const { data: preferredProvider } = await admin
            .from("providers")
            .select("profession")
            .eq("id", preferredProviderId)
            .single();
          if (preferredProvider) service_type = FOLLOW_UP_SERVICE_TYPE[preferredProvider.profession as Profession];
        }
      }
    }

    if (!service_type || !SERVICE_PRICES[service_type as ServiceType]) {
      return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
    }

    const standardFee = SERVICE_PRICES[service_type as ServiceType];

    let fee = standardFee;
    if (isFollowUp) {
      const { data: setting } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "follow_up_discount_rate")
        .maybeSingle();
      const discountRate = typeof setting?.value === "number" ? setting.value : 0.10;
      fee = Math.round(standardFee * (1 - discountRate));
    }

    const commission = Math.round(fee * 0.2);

    const { data: booking, error } = await admin
      .from("bookings")
      .insert({
        patient_id: user.id,
        service_type,
        profession: SERVICE_PROFESSION[service_type as ServiceType],
        care_episode_id: careEpisodeId,
        is_follow_up: isFollowUp,
        follow_up_id: resolvedFollowUpId,
        preferred_provider_id: preferredProviderId,
        patient_lat,
        patient_lng,
        patient_address,
        notes: notes ?? null,
        fee,
        commission,
        net_payout: fee - commission,
        status: "pending_payment",
        payment_status: "pending",
        // provider_id intentionally omitted — set by accept_dispatch() once a provider
        // accepts, which can only happen after the webhook confirms payment and the
        // dispatch trigger fires the booking into the provider pool. preferred_provider_id
        // (if set) only influences dispatch ordering, it does not pin the provider.
      })
      .select("id")
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: error?.message ?? "Failed to create booking" }, { status: 500 });
    }

    if (resolvedFollowUpId) {
      await supabase.from("follow_ups").update({ status: "booked", booking_id: booking.id, updated_at: new Date().toISOString() }).eq("id", resolvedFollowUpId);
    }

    return NextResponse.json({ booking_id: booking.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
