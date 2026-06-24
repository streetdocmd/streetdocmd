import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const adminSupabase = createAdminSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminUser } = await adminSupabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.formData();
  const action = body.get("action") as string;
  const notes = body.get("notes") as string | null;

  const statusMap: Record<string, string> = {
    approve: "verified",
    reject: "rejected",
    under_review: "under_review",
  };

  const newStatus = statusMap[action];
  if (!newStatus) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const update: Record<string, unknown> = { verification_status: newStatus };
  if (action === "approve") update.badge_issued = true;
  if (action === "reject" && notes) update.rejection_reason = notes;

  await adminSupabase.from("providers").update(update).eq("id", params.id);

  await adminSupabase.from("verification_logs").insert({
    provider_id: params.id,
    admin_id: user.id,
    action: action === "approve" ? "approved" : action === "reject" ? "rejected" : "reinstated",
    notes,
  });

  return NextResponse.redirect(new URL(`/dashboard/providers/${params.id}`, req.url));
}
