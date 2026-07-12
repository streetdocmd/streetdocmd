export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS } from "@/lib/shared";
import CareJourneyClient, { type JourneyStep } from "./CareJourneyClient";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const INV_STATUS_LABELS: Record<string, string> = {
  ordered:                    "Order received",
  confirmed:                  "Confirmed by lab",
  sample_collector_dispatched:"Sample collector on the way",
  sample_collected:           "Sample collected",
  processing:                 "Processing in lab",
  resulted:                   "Results ready",
};

const FLAG_LABELS: Record<string, string> = {
  normal:   "Normal",
  high:     "High ↑",
  low:      "Low ↓",
  critical: "Critical ⚠",
};

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending:      "Referral sent — awaiting response",
  acknowledged: "Hospital has acknowledged",
  in_progress:  "Patient seen / in progress",
  completed:    "Care completed",
  cancelled:    "Cancelled",
};

// ─── Step builder ─────────────────────────────────────────────────────────────

function buildSteps(booking: any, prescriptionOrder: any, referrals: any[]): JourneyStep[] {
  const visit        = booking.visits?.[0]          ?? null;
  const prescription = visit?.prescriptions?.[0]    ?? null;
  const invOrder     = booking.investigation_orders?.[0] ?? null;
  const delivery     = prescriptionOrder?.delivery_tracking?.[0] ?? null;
  const provider     = booking.providers;

  const bStatus   = booking.status as string;
  const afterEnRoute  = ["en_route","arrived","in_progress","completed","visit_complete"].includes(bStatus);
  const afterArrived  = ["arrived","in_progress","completed","visit_complete"].includes(bStatus);
  const isCompleted   = ["completed","visit_complete"].includes(bStatus) || !!booking.completed_at;

  const steps: JourneyStep[] = [];

  // 1 ─ Booking Confirmed
  steps.push({
    key: "booked",
    icon: "📋",
    label: "Booking Confirmed",
    timestamp: fmt(booking.created_at),
    status: "complete",
    details: [
      { label: "Service",  value: (SERVICE_LABELS as Record<string,string>)[booking.service_type] ?? booking.service_type },
      { label: "Provider", value: `Dr ${provider?.name ?? "—"}${provider?.credentials ? ` (${provider.credentials})` : ""}` },
      { label: "Address",  value: booking.patient_address ?? "—" },
    ],
  });

  // 2 ─ Provider En Route
  steps.push({
    key: "en_route",
    icon: "🚗",
    label: "Provider En Route",
    timestamp: booking.accepted_at ? fmt(booking.accepted_at) : null,
    status: afterEnRoute ? "complete" : bStatus === "accepted" ? "active" : "upcoming",
    details: booking.accepted_at ? [
      { label: "Departed", value: fmt(booking.accepted_at)! },
    ] : [],
  });

  // 3 ─ Provider Arrived
  steps.push({
    key: "arrived",
    icon: "📍",
    label: "Provider Arrived",
    timestamp: booking.arrived_at ? fmt(booking.arrived_at) : null,
    status: afterArrived ? "complete" : bStatus === "en_route" ? "active" : "upcoming",
    details: booking.arrived_at ? [
      { label: "Arrived at", value: fmt(booking.arrived_at)! },
    ] : [],
  });

  // 4 ─ Consultation Complete
  steps.push({
    key: "consultation",
    icon: "🩺",
    label: "Consultation Complete",
    timestamp: booking.completed_at ? fmt(booking.completed_at) : null,
    status: isCompleted ? "complete" : bStatus === "in_progress" ? "active" : "upcoming",
    details: isCompleted ? [
      visit?.diagnosis    ? { label: "Diagnosis",   value: visit.diagnosis }    : null,
      visit?.treatment    ? { label: "Treatment",   value: visit.treatment }    : null,
      prescription?.pdf_url ? { label: "Prescription PDF", value: "View PDF →", href: prescription.pdf_url } : null,
    ].filter(Boolean) as JourneyStep["details"] : [],
  });

  // 5-7 ─ Investigation steps (only if an order exists)
  if (invOrder) {
    const invStatus = invOrder.status as string;
    const afterSample = ["sample_collected","processing","resulted"].includes(invStatus);
    const isResulted  = invStatus === "resulted" || !!invOrder.resulted_at;

    // 5 ─ Investigations Ordered
    const tests = (invOrder.tests as any[]) ?? [];
    steps.push({
      key: "investigations",
      icon: "🔬",
      label: "Investigations Ordered",
      timestamp: invOrder.ordered_at ? fmt(invOrder.ordered_at) : null,
      status: "complete",
      details: [
        { label: "Tests",  value: tests.map((t: any) => t.test_name).join(" · ") || "—" },
        { label: "Status", value: INV_STATUS_LABELS[invStatus] ?? invStatus },
        invOrder.clinical_notes ? { label: "Clinical Indication", value: invOrder.clinical_notes } : null,
      ].filter(Boolean) as JourneyStep["details"],
    });

    // 6 ─ Sample Collected
    steps.push({
      key: "sample_collected",
      icon: "🧪",
      label: "Sample Collected",
      timestamp: null,
      status: afterSample ? "complete"
        : ["confirmed","sample_collector_dispatched"].includes(invStatus) ? "active"
        : "upcoming",
      details: [],
    });

    // 7 ─ Results Ready
    const results = (invOrder.investigation_results as any[]) ?? [];
    steps.push({
      key: "results",
      icon: "📊",
      label: "Results Ready",
      timestamp: invOrder.resulted_at ? fmt(invOrder.resulted_at) : null,
      status: isResulted ? "complete" : invStatus === "processing" ? "active" : "upcoming",
      details: isResulted ? [
        ...results.map((r: any) => ({
          label: r.test_name,
          value: r.result_value
            ? `${r.result_value}${r.unit ? ` ${r.unit}` : ""}${r.reference_range ? ` (ref: ${r.reference_range})` : ""}`
            : "—",
          flag: r.flag as JourneyStep["details"][0]["flag"],
        })),
        results.find((r: any) => r.result_pdf_url)
          ? { label: "Results PDF", value: "View PDF →", href: results.find((r: any) => r.result_pdf_url).result_pdf_url }
          : null,
      ].filter(Boolean) as JourneyStep["details"] : [],
    });
  }

  // 8-10 ─ Pharmacy steps (only if a prescription order exists)
  if (prescriptionOrder) {
    const rxStatus = prescriptionOrder.status as string;
    const hasDispatched = !!delivery?.dispatched_at || ["dispatched","delivered"].includes(rxStatus);
    const hasDelivered  = !!delivery?.delivered_at  || rxStatus === "delivered";

    // 8 ─ Sent to Pharmacy
    const rxDrugs = (prescriptionOrder.drugs as any[]) ?? [];
    steps.push({
      key: "pharmacy",
      icon: "💊",
      label: "Prescription Sent to Pharmacy",
      timestamp: prescriptionOrder.created_at ? fmt(prescriptionOrder.created_at) : null,
      status: "complete",
      details: [
        { label: "Pharmacy",     value: prescriptionOrder.pharmacy_partners?.name ?? "—" },
        { label: "Medications",  value: rxDrugs.map((d: any) => `${d.drug_name}${d.strength ? ` ${d.strength}` : ""}`).join(" · ") || "—" },
        { label: "Payment",      value: prescriptionOrder.payment_status === "paid" ? "✓ Paid" : "Awaiting payment" },
      ],
    });

    // 9 ─ Medications Dispatched
    steps.push({
      key: "dispatched",
      icon: "🛵",
      label: "Medications Dispatched",
      timestamp: delivery?.dispatched_at ? fmt(delivery.dispatched_at) : null,
      status: hasDispatched ? "complete"
        : ["confirmed","dispensing"].includes(rxStatus) ? "active"
        : "upcoming",
      details: hasDispatched ? [
        delivery?.rider_name     ? { label: "Rider",       value: delivery.rider_name }                        : null,
        delivery?.rider_phone    ? { label: "Phone",       value: delivery.rider_phone }                       : null,
        delivery?.estimated_arrival ? { label: "Estimated Arrival", value: fmt(delivery.estimated_arrival)! }  : null,
      ].filter(Boolean) as JourneyStep["details"] : [],
    });

    // 10 ─ Medications Delivered
    steps.push({
      key: "delivered",
      icon: "📦",
      label: "Medications Delivered",
      timestamp: delivery?.delivered_at ? fmt(delivery.delivered_at) : null,
      status: hasDelivered ? "complete" : rxStatus === "dispatched" ? "active" : "upcoming",
      details: hasDelivered ? [
        { label: "Delivered", value: delivery?.delivered_at ? fmt(delivery.delivered_at)! : "Confirmed" },
        delivery?.proof_of_delivery_url
          ? { label: "Proof of Delivery", value: "View Photo →", href: delivery.proof_of_delivery_url }
          : null,
      ].filter(Boolean) as JourneyStep["details"] : [],
    });
  }

  // Hospital referral steps (one step per referral — ADD, never replace)
  for (const ref of referrals) {
    const hospital = (ref.hospital_partners as any);
    const refStatus = ref.status as string;
    const isDone    = ["completed", "cancelled"].includes(refStatus);
    const isActive  = ["acknowledged", "in_progress"].includes(refStatus);

    steps.push({
      key: `referral_${ref.id}`,
      icon: ref.urgency === "emergency" ? "🚨" : "🏥",
      label: `Hospital Referral${ref.urgency === "emergency" ? " (Emergency)" : ""}${hospital?.name ? ` — ${hospital.name}` : ""}`,
      timestamp: ref.referred_at ? fmt(ref.referred_at) : null,
      status: isDone ? "complete" : isActive ? "active" : "upcoming",
      details: [
        { label: "Hospital", value: hospital?.name ?? "—" },
        { label: "Reason",   value: ref.reason ?? "—" },
        { label: "Status",   value: REFERRAL_STATUS_LABELS[refStatus] ?? refStatus },
        ref.pdf_url ? { label: "Referral Letter", value: "View Letter →", href: ref.pdf_url } : null,
      ].filter(Boolean) as JourneyStep["details"],
    });
  }

  // 11 ─ Follow-Up Due (if consultation complete and follow-up plan exists)
  if (isCompleted && visit?.follow_up_plan) {
    const followUpISO   = booking.completed_at ? addDays(booking.completed_at, 7) : null;
    const followUpPast  = followUpISO ? new Date() > new Date(followUpISO) : false;
    steps.push({
      key: "followup",
      icon: "📅",
      label: "Follow-Up Due",
      timestamp: followUpISO ? fmt(followUpISO) : null,
      status: followUpPast ? "complete" : "upcoming",
      details: [
        { label: "Instructions",  value: visit.follow_up_plan },
        followUpISO ? { label: "Target Date", value: fmt(followUpISO)! } : null,
      ].filter(Boolean) as JourneyStep["details"],
    });
  }

  return steps;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CareJourneyPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();

  // Verify ownership + fetch full booking tree
  const { data: booking } = await admin
    .from("bookings")
    .select(`
      id, status, service_type, created_at, accepted_at, arrived_at, completed_at,
      patient_address, patient_id,
      providers(id, name, credentials, specialty),
      visits(
        id, diagnosis, treatment, follow_up_plan, chief_complaint, created_at,
        prescriptions(id, drugs, pdf_url, created_at)
      ),
      investigation_orders(
        id, tests, status, ordered_at, resulted_at, clinical_notes,
        investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)
      )
    `)
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) redirect("/dashboard/bookings");

  // Prescription order is linked via visit_id, not booking_id
  const visitId = (booking.visits as any[])?.[0]?.id ?? null;
  let prescriptionOrder: any = null;
  if (visitId) {
    const { data: po } = await admin
      .from("prescription_orders")
      .select(`
        id, drugs, status, created_at, total_amount, payment_status,
        pharmacy_partners(name, phone),
        delivery_tracking(rider_name, rider_phone, dispatched_at, estimated_arrival, delivered_at, proof_of_delivery_url)
      `)
      .eq("visit_id", visitId)
      .maybeSingle();
    prescriptionOrder = po;
  }

  // Hospital referrals for this booking
  const { data: referrals } = await admin
    .from("hospital_referrals")
    .select(`id, status, urgency, reason, referred_at, pdf_url, hospital_partners(name)`)
    .eq("booking_id", params.id)
    .order("referred_at", { ascending: true });

  const steps = buildSteps(booking, prescriptionOrder, referrals ?? []);
  const serviceLabel = (SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type;
  const bookingDate  = new Date(booking.created_at).toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <a href="/dashboard/bookings" className="text-sm text-blue-brand hover:underline inline-flex items-center gap-1 mb-4">
          ← Back to Bookings
        </a>
        <h1 className="text-2xl font-bold text-gray-900">My Care Journey</h1>
        <p className="text-gray-500 mt-1">
          {serviceLabel} · {bookingDate}
        </p>
      </div>

      <CareJourneyClient steps={steps} />
    </div>
  );
}
