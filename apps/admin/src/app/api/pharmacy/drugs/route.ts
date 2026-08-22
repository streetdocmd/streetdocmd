import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminSupabase();
    const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
    if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { pharmacy_partner_id, drug_name, generic_name, formulation, strength, price, stock_quantity, prescription_required } = body;
    if (!pharmacy_partner_id || !drug_name) {
      return NextResponse.json({ error: "pharmacy_partner_id and drug_name are required" }, { status: 400 });
    }

    const stock = parseInt(stock_quantity) || 0;
    const { data, error } = await admin.from("drug_catalogue").insert({
      pharmacy_partner_id,
      drug_name,
      generic_name: generic_name || null,
      formulation: formulation || null,
      strength: strength || null,
      price: parseFloat(price) || 0,
      stock_quantity: stock,
      in_stock: stock > 0,
      prescription_required: !!prescription_required,
      updated_at: new Date().toISOString(),
    }).select("id, pharmacy_partner_id, drug_name, generic_name, formulation, strength, price, stock_quantity, prescription_required, active, updated_at, pharmacy_partners(name)").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
