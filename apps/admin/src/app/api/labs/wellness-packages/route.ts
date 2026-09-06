import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, price, description, included_tests, sort_order } = body;
  if (!name || !price) return NextResponse.json({ error: "name, price required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data, error } = await admin.from("wellness_packages").insert({
    name,
    price: parseFloat(price),
    description: description || null,
    included_tests: included_tests ?? [],
    sort_order: sort_order ? parseInt(sort_order, 10) : 0,
    active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
