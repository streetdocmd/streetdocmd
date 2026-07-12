import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { buildReferralPDF } from "@/lib/referral-pdf";

async function sendSMS(apiKey: string, to: string, sms: string) {
  return fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, from: "StreetdocMD", sms, type: "plain", channel: "generic", api_key: apiKey }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const {
    bookingId, patientId, providerId,
    urgency, reason, clinicalSummary,
    hospitalPartnerId,
  } = await req.json();

  if (!bookingId || !patientId || !providerId || !urgency || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch provider info
  const [{ data: booking }, { data: provider }, { data: patient }] = await Promise.all([
    admin.from("bookings").select("address, lat, lng").eq("id", bookingId).single(),
    admin.from("providers").select("name, credentials, specialty").eq("id", providerId).single(),
    admin.from("users").select("name, date_of_birth, phone").eq("id", patientId).single(),
  ]);

  // Fetch active diagnoses for this booking's clinical note
  const { data: noteRow } = await admin
    .from("clinical_notes")
    .select("id")
    .eq("booking_id", bookingId)
    .single();
  const { data: diagnoses } = noteRow
    ? await admin.from("clinical_note_diagnoses").select("plain_language_diagnosis").eq("clinical_note_id", noteRow.id)
    : { data: [] };
  const diagnosisText = (diagnoses ?? []).map((d: any) => d.plain_language_diagnosis).filter(Boolean).join("; ");

  let targetHospitals: any[] = [];

  if (urgency === "emergency") {
    // Absolute Rule 4: dispatch to top 3 simultaneously for emergencies
    const lat = booking?.lat ?? 6.5244;
    const lng = booking?.lng ?? 3.3792;
    const { data: nearby } = await admin
      .from("hospital_partners")
      .select("id, name, address, phone")
      .eq("active", true)
      .eq("emergency_available", true)
      .limit(20);

    // Sort by Haversine distance and pick top 3
    const withDist = (nearby ?? []).map((h: any) => {
      if (!h.lat || !h.lng) return { ...h, dist: 9999 };
      const dLat = (h.lat - lat) * Math.PI / 180;
      const dLng = (h.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat * Math.PI / 180) * Math.cos(h.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return { ...h, dist: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
    }).sort((a: any, b: any) => a.dist - b.dist).slice(0, 3);

    targetHospitals = withDist;
  } else {
    if (!hospitalPartnerId) return NextResponse.json({ error: "Hospital required for non-emergency referral" }, { status: 400 });
    const { data: h } = await admin.from("hospital_partners").select("id, name, address, phone").eq("id", hospitalPartnerId).single();
    if (h) targetHospitals = [h];
  }

  if (targetHospitals.length === 0) {
    return NextResponse.json({ error: "No eligible hospitals found" }, { status: 404 });
  }

  // Compute patient age
  const dob = patient?.date_of_birth ? new Date(patient.date_of_birth) : null;
  const patientAge = dob
    ? String(Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)))
    : "—";
  const providerName = `Dr ${provider?.name ?? "Unknown"}`;
  const date = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  const termiiKey = process.env.TERMII_API_KEY;

  const referralIds: string[] = [];

  await Promise.all(targetHospitals.map(async (hospital: any) => {
    // Build PDF
    const pdfBytes = await buildReferralPDF({
      refId: bookingId,
      date,
      providerName,
      providerCredentials: provider?.credentials ?? "",
      providerSpecialty: provider?.specialty ?? "",
      patientName: patient?.name ?? "Patient",
      patientAge,
      hospitalName: hospital.name,
      hospitalAddress: hospital.address ?? "",
      urgency,
      reason,
      clinicalSummary: clinicalSummary ?? "",
      diagnoses: diagnosisText,
    });

    // Upload PDF to Supabase storage
    const fileName = `${bookingId}-${hospital.id}-${Date.now()}.pdf`;
    const { data: uploaded } = await admin.storage
      .from("referral-letters")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

    const pdfUrl = uploaded
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/referral-letters/${fileName}`
      : null;

    // Insert referral record
    const { data: referral } = await admin.from("hospital_referrals").insert({
      booking_id: bookingId,
      patient_id: patientId,
      provider_id: providerId,
      hospital_partner_id: hospital.id,
      urgency,
      reason,
      clinical_summary: clinicalSummary ?? null,
      pdf_url: pdfUrl,
      status: "pending",
      referred_at: new Date().toISOString(),
    }).select("id").single();

    if (referral?.id) referralIds.push(referral.id);

    // Notify hospital via SMS
    if (termiiKey && hospital.phone) {
      const urgencyText = urgency === "emergency" ? "EMERGENCY REFERRAL" : urgency === "urgent" ? "URGENT REFERRAL" : "Referral";
      await sendSMS(termiiKey, hospital.phone,
        `StreetdocMD ${urgencyText}: A patient has been referred to ${hospital.name}. Please log in to your hospital portal to review. Portal: https://streetdocmd.vercel.app/hospital-portal`
      );
    }
  }));

  // Notify patient
  if (termiiKey && patient?.phone) {
    const hospitalNames = targetHospitals.map((h: any) => h.name).join(", ");
    await sendSMS(termiiKey, patient.phone,
      `Your doctor has issued a referral to ${hospitalNames}. Please follow up with the hospital${targetHospitals.length > 1 ? "s" : ""} at your earliest convenience.`
    );
  }

  return NextResponse.json({ ok: true, referral_ids: referralIds, hospitals: targetHospitals.length });
}
