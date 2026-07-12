import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { buildPrescriptionPDF, type Drug } from "@/lib/prescription-pdf";

interface VisitNotes {
  chief_complaint: string;
  diagnosis: string;
  treatment: string;
  follow_up_plan: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, notes, drugs }: { bookingId: string; notes: VisitNotes; drugs: Drug[] } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

  const admin = createAdminSupabase();

  // Verify booking belongs to this provider and is completable
  const { data: provider } = await admin
    .from("providers")
    .select("id, name, credentials, specialty")
    .eq("user_id", user.id)
    .single();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, patient_id, patient:users!patient_id(name)")
    .eq("id", bookingId)
    .eq("provider_id", provider.id)
    .single();

  if (!booking || booking.status !== "in_progress") {
    return NextResponse.json({ error: "Booking not found or not in progress" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patientName = (booking.patient as any)?.[0]?.name ?? (booking.patient as any)?.name ?? "Patient";

  // 1. Complete the booking
  await admin.from("bookings").update({ status: "completed", completed_at: now }).eq("id", bookingId);

  // 2. Insert visit record
  const { data: visit } = await admin.from("visits").insert({
    booking_id:             bookingId,
    chief_complaint:        notes.chief_complaint || null,
    diagnosis:              notes.diagnosis || null,
    treatment:              notes.treatment || null,
    follow_up_plan:         notes.follow_up_plan || null,
  }).select("id").single();

  let pdfUrl: string | null = null;

  // 3. Generate prescription PDF if drugs were prescribed
  if (visit && drugs.length > 0) {
    try {
      const dateStr = new Date().toLocaleDateString("en-NG", {
        day: "numeric", month: "long", year: "numeric",
      });

      const pdfBytes = await buildPrescriptionPDF({
        refId:               visit.id,
        date:                dateStr,
        providerName:        provider.name,
        providerCredentials: provider.credentials ?? "",
        providerSpecialty:   provider.specialty ?? "",
        patientName,
        diagnosis:           notes.diagnosis,
        treatment:           notes.treatment,
        followUp:            notes.follow_up_plan,
        drugs,
      });

      const fileName = `${visit.id}.pdf`;

      const { error: uploadErr } = await admin.storage
        .from("prescriptions")
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadErr) {
        const { data: urlData } = admin.storage.from("prescriptions").getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;

        await admin.from("prescriptions").insert({
          visit_id:    visit.id,
          booking_id:  bookingId,
          provider_id: provider.id,
          patient_id:  booking.patient_id,
          drugs,
          pdf_url:     pdfUrl,
        });
      }
    } catch {
      // PDF generation is non-critical — visit is already completed
    }
  } else if (visit && notes.diagnosis) {
    // No drugs but still create a prescription record (no PDF)
    await admin.from("prescriptions").insert({
      visit_id:    visit.id,
      booking_id:  bookingId,
      provider_id: provider.id,
      patient_id:  booking.patient_id,
      drugs:       [],
    });
  }

  return NextResponse.json({ ok: true, pdfUrl, visitId: visit?.id ?? null, patientId: booking.patient_id });
}
