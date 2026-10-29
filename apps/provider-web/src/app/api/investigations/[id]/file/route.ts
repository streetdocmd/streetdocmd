import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// GET /api/investigations/:id/file: the requesting doctor opens the lab's
// result report through a 10 minute link (lab-results is private, migration 067).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("id, provider_id, investigation_results(result_pdf_url)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || !provider || order.provider_id !== provider.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = ((order.investigation_results as any[]) ?? []).find(r => r.result_pdf_url)?.result_pdf_url;
  if (!path) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const { data } = await admin.storage.from("lab-results").createSignedUrl(path, 600);
  if (!data?.signedUrl) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
