import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { labPartnerId, catalogueIds, clinicalNotes } = await req.json();
  if (!labPartnerId || !catalogueIds?.length) {
    return NextResponse.json({ error: "labPartnerId and at least one test are required" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  // Recompute tests/prices from the catalogue server-side — never trust
  // client-sent prices for something that gets billed.
  const { data: catalogueItems } = await admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, price")
    .eq("lab_partner_id", labPartnerId)
    .eq("active", true)
    .in("id", catalogueIds);

  if (!catalogueItems?.length) {
    return NextResponse.json({ error: "Selected tests are no longer available" }, { status: 400 });
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
      lab_partner_id: labPartnerId,
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
