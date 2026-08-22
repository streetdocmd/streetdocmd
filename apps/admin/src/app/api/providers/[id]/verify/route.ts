import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const adminSupabase = createAdminSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

    const { data: adminUser, error: adminLookupError } = await adminSupabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminLookupError) {
      return NextResponse.json({ error: `Could not verify your admin account: ${adminLookupError.message}` }, { status: 500 });
    }
    if (adminUser?.role !== "admin") {
      return NextResponse.json({ error: "Your account does not have admin permissions to perform this action." }, { status: 403 });
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
    if (!newStatus) return NextResponse.json({ error: `Invalid action "${action}".` }, { status: 400 });

    const update: Record<string, unknown> = { verification_status: newStatus };
    if (action === "approve") update.badge_issued = true;
    if (action === "reject" && notes) update.rejection_reason = notes;

    const { error: updateError } = await adminSupabase.from("providers").update(update).eq("id", params.id);
    if (updateError) {
      return NextResponse.json({ error: `Failed to update provider status: ${updateError.message}` }, { status: 500 });
    }

    const { error: logError } = await adminSupabase.from("verification_logs").insert({
      provider_id: params.id,
      admin_id: user.id,
      action: action === "approve" ? "approved" : action === "reject" ? "rejected" : "reinstated",
      notes,
    });
    if (logError) {
      return NextResponse.json({ error: `Status was updated, but failed to record the verification log: ${logError.message}` }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/dashboard/providers/${params.id}`, req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
