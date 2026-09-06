import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { catalogueIds, clinicalNotes } = await req.json();
  if (!catalogueIds?.length) {
    return NextResponse.json({ error: "At least one test is required" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  // Recompute tests/prices from the platform-wide catalogue server-side —
  // never trust client-sent prices for something that gets billed.
  const { data: catalogueItems } = await admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, price")
    .eq("scope", "platform")
    .eq("active", true)
    .in("id", catalogueIds);

  if (!catalogueItems?.length || catalogueItems.length !== catalogueIds.length) {
    return NextResponse.json({ error: "Selected tests are no longer available" }, { status: 400 });
  }

  // The catalogue is platform-wide (not tied to any one partner) — resolve
  // which lab partner actually fulfills this order, same "first active
  // partner" selection the rest of this flow already used before the
  // catalogue was decoupled from a specific partner.
  const { data: labPartner } = await admin
    .from("lab_partners")
    .select("id")
    .eq("active", true)
    .limit(1)
    .single();

  if (!labPartner) {
    return NextResponse.json({ error: "No lab partner available right now" }, { status: 400 });
  }

  const tests = catalogueItems.map(item => ({
    catalogue_id: item.id,
    test_name: item.test_name,
    test_code: item.test_code,
    price: item.price,
  }));

  const { data: order, error } = await admin
    .from("investigation_orders")
    .insert({
      patient_id: user.id,
      provider_id: null,
      lab_partner_id: labPartner.id,
      tests,
      clinical_notes: clinicalNotes ?? null,
      status: "ordered",
      requested_by: "patient",
    })
    .select("id")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Failed to place order" }, { status: 500 });
  }

  return NextResponse.json({ order_id: order.id });
}
