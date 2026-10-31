import { NextRequest, NextResponse } from "next/server";
import { coverage, doctorVisit } from "@/lib/investigation-access";

// POST /api/investigations: a doctor orders tests during a home visit
// (migration 067). Body: { bookingId, tests: [{ id, labId }] (a test on the
// shared list and the lab the doctor chose for it), notes,
// collection: "home" | "doctor", sampleNotes? }.
// Every test must be offered by a lab that serves the visit address
// (migration 073), so a patient is never asked to pay for a test no lab can do.
// The order waits for the patient's approval and payment. Checkout keeps the
// doctor's labs where they still serve the address (migration 074). "doctor" means
// the sample was taken during the visit, so there's no home collection fee.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const picks = new Map<string, string | null>();
  for (const t of (Array.isArray(body.tests) ? body.tests : []).slice(0, 30)) {
    if (typeof t?.id === "string") picks.set(t.id, typeof t.labId === "string" ? t.labId : null);
  }
  const ids = Array.from(picks.keys());
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  const collection = body.collection === "doctor" ? "doctor" : "home";
  if (!ids.length) return NextResponse.json({ error: "Choose at least one test." }, { status: 400 });
  if (!notes) return NextResponse.json({ error: "Add the clinical indication for these tests." }, { status: 400 });

  const v = await doctorVisit(body.bookingId);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });
  const { admin, provider, booking } = v;
  if (!["arrived", "in_progress", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "Tests can be ordered once you're with the patient." }, { status: 409 });
  }

  const { data: tests } = await admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, preparation")
    .eq("scope", "platform")
    .eq("active", true)
    .in("id", ids);
  if (!tests?.length || tests.length !== ids.length) {
    return NextResponse.json({ error: "Some of the selected tests are no longer available." }, { status: 400 });
  }

  const labs = await coverage(admin, ids, booking.patient_lat, booking.patient_lng);
  const counts = collection === "doctor" ? labs.doctor : labs.home;
  const unavailable = tests.filter(t => !(counts.get(t.id) ?? 0)).map(t => t.test_name);
  // A chosen lab must really offer that test at this address
  const { data: offers } = await admin.rpc("investigation_offers", {
    p_test_ids: ids, p_lat: booking.patient_lat, p_lng: booking.patient_lng, p_collection: collection,
  });
  const offered = new Set(((offers ?? []) as any[]).map(o => `${o.platform_test_id}:${o.lab_partner_id}`));
  const preferredLab = (id: string) => {
    const lab = picks.get(id);
    return lab && offered.has(`${id}:${lab}`) ? lab : null;
  };
  if (unavailable.length) {
    return NextResponse.json({
      error: `No laboratory near this patient offers ${unavailable.join(", ")}. Remove ${unavailable.length > 1 ? "them" : "it"} or choose another test.`,
      unavailable,
    }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: order, error } = await admin
    .from("investigation_orders")
    .insert({
      booking_id: booking.id,
      care_episode_id: booking.care_episode_id ?? null,
      patient_id: booking.patient_id,
      provider_id: provider.id,
      requested_by: "provider",
      status: "awaiting_patient_approval",
      payment_status: "unpaid",
      tests: tests.map(t => ({ catalogue_id: t.id, platform_test_id: t.id, test_name: t.test_name, test_code: t.test_code, price: null, preparation: t.preparation, preferred_lab_id: preferredLab(t.id) })),
      clinical_notes: notes,
      collection_method: collection,
      // The visit address is the default; the patient confirms it at checkout
      collection_address: booking.patient_address,
      collection_lat: booking.patient_lat,
      collection_lng: booking.patient_lng,
      ...(collection === "doctor" ? {
        collected_at: now,
        collected_by: "Requesting doctor",
        identity_checked: true,
        sample_notes: typeof body.sampleNotes === "string" ? body.sampleNotes.trim().slice(0, 500) || null : null,
      } : {}),
    })
    .select("id")
    .single();
  if (error || !order) return NextResponse.json({ error: "Couldn't save the order. Please try again." }, { status: 500 });
  return NextResponse.json({ order_id: order.id });
}
