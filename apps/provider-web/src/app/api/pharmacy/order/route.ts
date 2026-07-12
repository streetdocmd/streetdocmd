import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";
import { nearestPartner } from "@/lib/proximity";

// Controlled drug keywords — orders containing these are flagged for admin review
const CONTROLLED_KEYWORDS = [
  "codeine", "tramadol", "morphine", "fentanyl", "oxycodone", "pethidine",
  "pentazocine", "buprenorphine", "diazepam", "alprazolam", "lorazepam",
  "clonazepam", "nitrazepam", "phenobarbitone", "phenobarbital",
  "methylphenidate", "amphetamine",
];

function isControlled(drugs: { name: string }[]): boolean {
  return drugs.some(d =>
    CONTROLLED_KEYWORDS.some(k => d.name.toLowerCase().includes(k))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { visitId, patientId, prescriptionPdfUrl, drugs } = await req.json();
  if (!patientId || !drugs?.length) {
    return NextResponse.json({ error: "patientId and drugs required" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  // Get provider
  const { data: provider } = await admin
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  // Get nearest active pharmacy partner by patient location
  let bookingLat: number | null = null;
  let bookingLng: number | null = null;
  if (visitId) {
    const { data: bk } = await admin.from("bookings").select("lat, lng").eq("id", visitId).single();
    bookingLat = bk?.lat ?? null;
    bookingLng = bk?.lng ?? null;
  }
  const { data: pharmacies } = await admin
    .from("pharmacy_partners")
    .select("id, name, delivery_radius_km, lat, lng")
    .eq("active", true);
  if (!pharmacies?.length) return NextResponse.json({ error: "No active pharmacy partner" }, { status: 404 });
  const pharmacy = bookingLat != null && bookingLng != null
    ? (nearestPartner(pharmacies, bookingLat, bookingLng) ?? pharmacies[0])
    : pharmacies[0];

  // Build drug rows — each drug from prescription becomes an order line
  const drugRows = drugs.map((d: { name: string; dosage?: string; frequency?: string; duration?: string }) => ({
    drug_name:  d.name,
    strength:   d.dosage ?? null,
    frequency:  d.frequency ?? null,
    duration:   d.duration ?? null,
    quantity:   1,
    price:      0,  // price updated by pharmacy on confirmation
  }));

  const totalAmount = 0; // set to 0 until pharmacy confirms prices
  const commissionAmount = 0;
  const requiresReview = isControlled(drugs.map((d: { name: string }) => ({ name: d.name })));

  const { data: order, error } = await admin.from("prescription_orders").insert({
    visit_id:              visitId ?? null,
    patient_id:            patientId,
    provider_id:           provider.id,
    pharmacy_partner_id:   pharmacy.id,
    prescription_pdf_url:  prescriptionPdfUrl ?? null,
    drugs:                 drugRows,
    status:                "sent",         // skip pending_payment until pharmacy confirms price
    total_amount:          totalAmount,
    commission_amount:     commissionAmount,
    requires_review:       requiresReview,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, orderId: order.id, pharmacyName: pharmacy.name, requiresReview });
}
