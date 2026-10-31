import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { nearestPartner } from "@/lib/proximity";

// Controlled drug keywords — orders containing these are flagged for review
const CONTROLLED_KEYWORDS = [
  "codeine", "tramadol", "morphine", "fentanyl", "oxycodone", "pethidine",
  "pentazocine", "buprenorphine", "diazepam", "alprazolam", "lorazepam",
  "clonazepam", "nitrazepam", "phenobarbitone", "phenobarbital",
  "methylphenidate", "amphetamine",
];

const OPEN = ["sent", "pending_payment", "confirmed", "dispensing", "dispatched", "delivered"];

// POST /api/prescriptions/:id/order: the patient finishes reviewing a
// prescription (migration 072).
//   { haveAll: true }                 they already have everything
//   { keep: [indexes], lat, lng, address }  send those medicines to the nearest
//                                     pharmacy, which prices them
// The prescription itself is never edited: it stays the doctor's record.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: prescription } = await admin
    .from("prescriptions")
    .select("id, patient_id, provider_id, booking_id, drugs")
    .eq("id", params.id)
    .maybeSingle();
  if (!prescription || prescription.patient_id !== user.id) {
    return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
  }

  const { data: orders } = await admin
    .from("prescription_orders")
    .select("id, status, pharmacy_partner_id")
    .eq("prescription_id", prescription.id);
  const open = (orders ?? []).find(o => OPEN.includes(o.status));
  if (open) return NextResponse.json({ error: "This prescription is already with a pharmacy.", order_id: open.id }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.haveAll === true) {
    await admin.from("prescriptions").update({ patient_reviewed_at: now }).eq("id", prescription.id);
    return NextResponse.json({ ok: true });
  }

  const all: any[] = Array.isArray(prescription.drugs) ? prescription.drugs : [];
  const keep = new Set<number>(Array.isArray(body.keep) ? body.keep.filter((i: unknown) => Number.isInteger(i)) : []);
  const chosen = all.filter((_, i) => keep.has(i));
  if (!chosen.length) return NextResponse.json({ error: "Choose at least one medicine." }, { status: 400 });

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 500) : "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
    return NextResponse.json({ error: "Choose where to deliver your medicines." }, { status: 400 });
  }

  // A pharmacy that already said it can't supply this prescription isn't asked again
  const refused = new Set((orders ?? []).filter(o => o.status === "cancelled").map(o => o.pharmacy_partner_id));
  const { data: partners } = await admin
    .from("pharmacy_partners")
    .select("id, name, lat, lng")
    .eq("active", true)
    .not("lat", "is", null)
    .not("lng", "is", null);
  const pharmacy = nearestPartner((partners ?? []).filter(p => !refused.has(p.id)), lat, lng);
  if (!pharmacy) {
    return NextResponse.json({ error: "No pharmacy is available for this right now. Please try again later." }, { status: 404 });
  }

  const name = (d: any) => String(d?.name ?? d?.drug_name ?? "").trim();
  const { data: booking } = await admin.from("bookings").select("care_episode_id").eq("id", prescription.booking_id).maybeSingle();

  const { data: order, error } = await admin.from("prescription_orders").insert({
    patient_id: user.id,
    provider_id: prescription.provider_id,
    prescription_id: prescription.id,
    requested_by: "provider",
    care_episode_id: booking?.care_episode_id ?? null,
    pharmacy_partner_id: pharmacy.id,
    delivery_address: address,
    drugs: chosen.map(d => ({
      drug_name: name(d),
      strength: d.dosage ?? null,
      frequency: d.frequency ?? null,
      duration: d.duration ?? null,
      quantity: Math.max(1, parseInt(d.quantity) || 1),
      price: 0, // the pharmacy prices each line
    })),
    status: "sent",
    payment_status: "pending",
    total_amount: 0,
    commission_amount: 0,
    requires_review: chosen.some(d => CONTROLLED_KEYWORDS.some(k => name(d).toLowerCase().includes(k))),
  }).select("id").single();
  if (error || !order) return NextResponse.json({ error: "Couldn't send your prescription. Please try again." }, { status: 500 });

  await admin.from("prescriptions").update({ patient_reviewed_at: now }).eq("id", prescription.id);
  return NextResponse.json({ order_id: order.id, pharmacy: pharmacy.name });
}
