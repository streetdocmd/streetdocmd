import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";

// POST /api/investigations { testIds }: a patient starts a self-service test
// order (migration 067). It's created as a draft with just the chosen
// StreetdocMD tests; the order page then takes the address, time and an
// optional outside doctor's request, quotes the best lab and takes payment.
export async function POST(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.testIds) ? body.testIds.filter((x: unknown) => typeof x === "string").slice(0, 30) : [];
  if (!ids.length) return NextResponse.json({ error: "Choose at least one test." }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: tests } = await admin
    .from("investigation_catalogue")
    .select("id, test_name, test_code, price")
    .eq("scope", "platform")
    .eq("active", true)
    .in("id", ids);
  if (!tests?.length || tests.length !== new Set(ids).size) {
    return NextResponse.json({ error: "Some of the selected tests are no longer available." }, { status: 400 });
  }

  const { data: order, error } = await admin
    .from("investigation_orders")
    .insert({
      patient_id: user.id,
      provider_id: null,
      requested_by: "patient",
      status: "draft",
      payment_status: "unpaid",
      tests: tests.map(t => ({ catalogue_id: t.id, platform_test_id: t.id, test_name: t.test_name, test_code: t.test_code, price: null })),
      clinical_notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
    })
    .select("id")
    .single();
  if (error || !order) return NextResponse.json({ error: "Couldn't start your order. Please try again." }, { status: 500 });
  return NextResponse.json({ order_id: order.id });
}
