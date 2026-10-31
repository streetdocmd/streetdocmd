import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";
import { quoteTests, testsSnapshot, transition } from "@/lib/investigations";

const PAYABLE = ["draft", "awaiting_patient_approval", "awaiting_payment", "payment_failed"];
const WINDOWS = ["morning", "afternoon", "evening"];
const FILE_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// POST /api/investigations/:id/checkout (multipart form)
// The patient approves (a doctor's order) or books (their own order): the
// collection address, date and time window, contact phone, and optionally an
// outside doctor's request. The best lab is chosen and priced here, on the
// server, and a Paystack payment is started. Only the Paystack webhook marks
// the order paid (investigation_confirm_payment, migration 067).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const field = (k: string) => String(form.get(k) ?? "").trim();

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, patient_id, status, payment_status, tests, collection_method, external_request")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || order.patient_id !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
  if (!PAYABLE.includes(order.status)) return NextResponse.json({ error: "This order can no longer be paid for." }, { status: 409 });

  const doctorCollected = order.collection_method === "doctor";
  const lat = Number(field("lat")), lng = Number(field("lng"));
  const address = field("address").slice(0, 300);
  const phone = field("phone").slice(0, 30);
  const date = field("date");
  const window = field("window");

  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Choose the collection address." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Enter a phone number the collector can call." }, { status: 400 });
  if (!doctorCollected) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(`${date}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime()) || d < today) {
      return NextResponse.json({ error: "Choose a collection date from today onwards." }, { status: 400 });
    }
    if (!WINDOWS.includes(window)) return NextResponse.json({ error: "Choose a time window." }, { status: 400 });
  }

  // Optional outside doctor's request (patient self-service only)
  let external = order.external_request as Record<string, unknown> | null;
  const extDoctor = field("ext_doctor").slice(0, 120);
  const extFacility = field("ext_facility").slice(0, 160);
  const extNotes = field("ext_notes").slice(0, 1000);
  const extFile = form.get("ext_file");
  if (extDoctor || extFacility || extNotes || (extFile instanceof File && extFile.size > 0)) {
    external = { ...(external ?? {}), doctor: extDoctor || null, facility: extFacility || null, notes: extNotes || null };
    if (extFile instanceof File && extFile.size > 0) {
      const ext = FILE_TYPES[extFile.type];
      if (!ext) return NextResponse.json({ error: "The request must be a PDF, JPG or PNG file." }, { status: 400 });
      if (extFile.size > 10 * 1024 * 1024) return NextResponse.json({ error: "The request file must be smaller than 10 MB." }, { status: 400 });
      const path = `${order.id}/request-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from("investigation-requests")
        .upload(path, Buffer.from(await extFile.arrayBuffer()), { contentType: extFile.type });
      if (upErr) return NextResponse.json({ error: "Couldn't upload the request file. Please try again." }, { status: 500 });
      external.file_path = path;
    }
  }

  const ids = ((order.tests as any[]) ?? []).map(t => t?.platform_test_id).filter(Boolean);
  let quote;
  try {
    quote = await quoteTests(admin, ids, lat, lng, doctorCollected ? "doctor" : "home");
  } catch {
    return NextResponse.json({ error: "Couldn't work out the price. Please try again." }, { status: 500 });
  }
  if (!quote) {
    return NextResponse.json({ error: "No partner lab near you lists all of these tests yet. We'll let you know when one does, or try another address.", code: "no_lab" }, { status: 409 });
  }

  const { error: upErr } = await admin.from("investigation_orders").update({
    tests: testsSnapshot(quote),
    lab_partner_id: quote.lab_partner_id,
    lab_price_total: quote.tests_total,
    tests_total: quote.tests_total,
    collection_fee: quote.collection_fee,
    service_charge: quote.service_charge,
    total_amount: quote.total,
    collection_address: address,
    collection_lat: lat,
    collection_lng: lng,
    contact_phone: phone,
    preferred_date: doctorCollected ? null : date,
    preferred_window: doctorCollected ? null : window,
    external_request: external,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id).eq("payment_status", "unpaid");
  if (upErr) return NextResponse.json({ error: "Couldn't save your details. Please try again." }, { status: 500 });

  const moveErr = await transition(admin, order.id, "awaiting_payment", user.id, "patient",
    order.status === "awaiting_patient_approval" ? "Patient approved the order" : "Patient confirmed details");
  if (moveErr) return NextResponse.json({ error: "This order can no longer be paid for." }, { status: 409 });

  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKey) return NextResponse.json({ error: "Payment isn't available right now. Please try again later." }, { status: 503 });

  const { data: patient } = await admin.from("users").select("email").eq("id", user.id).maybeSingle();
  const reference = `inv_${order.id}_${Date.now()}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.streetdocmd.com";
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: patient?.email ?? `patient+${user.id}@streetdocmd.com`,
      amount: Math.round(quote.total * 100),
      reference,
      callback_url: `${base}/api/investigations/${order.id}/payment/verify`,
      metadata: { type: "investigation_order", order_id: order.id },
    }),
  }).catch(() => null);
  const json = res ? await res.json().catch(() => null) : null;
  if (!json?.data?.authorization_url) {
    return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }

  await admin.from("investigation_orders").update({ payment_reference: reference }).eq("id", order.id);
  return NextResponse.json({ authorization_url: json.data.authorization_url, total: quote.total });
}
