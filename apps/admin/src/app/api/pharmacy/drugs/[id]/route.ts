import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminSupabase();
    const { data: adminUser } = await admin.from("users").select("role").eq("id", user.id).single();
    if (adminUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.price !== undefined) update.price = parseFloat(body.price) || 0;
    if (body.stock_quantity !== undefined) {
      const stock = parseInt(body.stock_quantity) || 0;
      update.stock_quantity = stock;
      update.in_stock = stock > 0;
    }
    if (body.active !== undefined) update.active = !!body.active;

    const { error } = await admin.from("drug_catalogue").update(update).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
