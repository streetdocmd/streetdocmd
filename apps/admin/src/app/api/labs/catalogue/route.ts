import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { test_name, test_code, price, turnaround_hours, sample_type } = body;
  if (!test_name || !price) return NextResponse.json({ error: "test_name, price required" }, { status: 400 });

  const admin = createAdminSupabase();
  // scope is always "platform" here — lab-partner-scoped catalogue rows are
  // managed separately (by providers ordering during a visit / lab partner
  // onboarding), never through this admin route.
  const { data, error } = await admin.from("investigation_catalogue").insert({
    lab_partner_id: null,
    scope: "platform",
    test_name,
    test_code: test_code || null,
    price: parseFloat(price),
    turnaround_hours: turnaround_hours ? parseInt(turnaround_hours, 10) : null,
    sample_type: sample_type || null,
    home_collection: true,
    active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
