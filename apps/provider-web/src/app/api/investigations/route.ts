import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// POST /api/investigations: a doctor orders tests during a home visit
// (migration 067). Body: { bookingId, testIds (tests on the list), testNames
// (anything else, which joins the list: migration 073), notes,
// collection: "home" | "doctor", sampleNotes? }.
// The order waits for the patient's approval and payment; the best lab is
// chosen when they check out. "doctor" means the sample was taken during the
// visit, so there's no home collection fee.
export async function POST(req: NextRequest) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const listed: string[] = Array.isArray(body.testIds) ? body.testIds.filter((x: unknown) => typeof x === "string").slice(0, 30) : [];
  const typed: string[] = Array.isArray(body.testNames)
    ? body.testNames.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 200)).slice(0, 10)
    : [];
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  const collection = body.collection === "doctor" ? "doctor" : "home";
  if (!listed.length && !typed.length) return NextResponse.json({ error: "Choose at least one test." }, { status: 400 });
  if (!notes) return NextResponse.json({ error: "Add the clinical indication for these tests." }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id, profession").eq("user_id", user.id).maybeSingle();
  if (!provider || provider.profession !== "doctor") return NextResponse.json({ error: "Only doctors can order investigations." }, { status: 403 });

  const { data: booking } = await admin
    .from("bookings")
    .select("id, patient_id, provider_id, status, care_episode_id, patient_address, patient_lat, patient_lng")
    .eq("id", typeof body.bookingId === "string" ? body.bookingId : "")
    .maybeSingle();
  if (!booking || booking.provider_id !== provider.id) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (!["arrived", "in_progress", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "Tests can be ordered once you're with the patient." }, { status: 409 });
  }

  const ids = [...listed];
  for (const name of typed) {
    const { data: id, error: testErr } = await admin.rpc("investigation_platform_test", { p_name: name, p_requested: true });
    if (testErr || !id) return NextResponse.json({ error: "Couldn't save the order. Please try again." }, { status: 500 });
    ids.push(id as string);
  }

  const { data: tests } = await admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, preparation")
    .eq("scope", "platform")
    .eq("active", true)
    .in("id", ids);
  if (!tests?.length || tests.length !== new Set(ids).size) {
    return NextResponse.json({ error: "Some of the selected tests are no longer available." }, { status: 400 });
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
      tests: tests.map(t => ({ catalogue_id: t.id, platform_test_id: t.id, test_name: t.test_name, test_code: t.test_code, price: null, preparation: t.preparation })),
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
