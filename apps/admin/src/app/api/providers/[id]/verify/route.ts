import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

type Action = "approve" | "reject" | "under_review";

const NEW_STATUS: Record<Action, string> = {
  approve: "verified",
  reject: "rejected",
  under_review: "under_review",
};

// Which current statuses each action may be taken from.
const ALLOWED_FROM: Record<Action, string[]> = {
  approve: ["pending", "under_review", "rejected"],
  reject: ["pending", "under_review", "verified"], // from verified = revoke
  under_review: ["pending", "rejected"],
};

async function readBody(req: NextRequest): Promise<{ action: string | null; notes: string | null }> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    return { action: b?.action ?? null, notes: b?.notes ?? null };
  }
  const fd = await req.formData();
  return { action: (fd.get("action") as string) ?? null, notes: (fd.get("notes") as string) ?? null };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi();
    if ("response" in auth) return auth.response;
    const adminUser = auth.user;
    const admin = createAdminSupabase();

    const { action: rawAction, notes: rawNotes } = await readBody(req);
    const action = rawAction as Action;
    if (!NEW_STATUS[action]) return NextResponse.json({ error: `Invalid action "${rawAction}".` }, { status: 400 });
    const notes = rawNotes?.trim() || null;
    if (action === "reject" && !notes) {
      return NextResponse.json({ error: "Please enter a reason so the provider knows what to fix." }, { status: 400 });
    }

    const { data: provider, error: loadErr } = await admin
      .from("providers")
      .select("id, verification_status")
      .eq("id", params.id)
      .maybeSingle();
    if (loadErr) return NextResponse.json({ error: `Could not load provider: ${loadErr.message}` }, { status: 500 });
    if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

    const current = provider.verification_status as string;
    if (!ALLOWED_FROM[action].includes(current)) {
      return NextResponse.json(
        { error: `This provider is already ${current.replace(/_/g, " ")} — refresh the page to see the latest status.` },
        { status: 409 }
      );
    }
    const revoking = action === "reject" && current === "verified";

    const update: Record<string, unknown> = { verification_status: NEW_STATUS[action] };
    if (action === "approve") {
      update.badge_issued = true;
      update.rejection_reason = null;
    }
    if (action === "reject") {
      update.badge_issued = false;
      update.rejection_reason = notes;
    }

    // Conditional on the status we just read, so two admins acting at once
    // can't both apply (the second gets a clear conflict instead).
    const { data: updated, error: updateError } = await admin
      .from("providers")
      .update(update)
      .eq("id", params.id)
      .eq("verification_status", current)
      .select("id, user_id, name");
    if (updateError) {
      return NextResponse.json({ error: `Failed to update provider status: ${updateError.message}` }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Another admin updated this provider just now — refresh to see the latest status." }, { status: 409 });
    }

    const warnings: string[] = [];

    // Audit trail. verification_logs.action only allows approved/rejected/
    // suspended/reinstated until migration 051 adds 'under_review'.
    const logAction = action === "approve" ? "approved" : revoking ? "suspended" : action === "reject" ? "rejected" : "under_review";
    let { error: logError } = await admin.from("verification_logs").insert({
      provider_id: params.id, admin_id: adminUser.id, action: logAction, notes,
    });
    if (logError && logAction === "under_review") {
      ({ error: logError } = await admin.from("verification_logs").insert({
        provider_id: params.id, admin_id: adminUser.id, action: "reinstated", notes: notes ?? "Marked under review",
      }));
    }
    if (logError) warnings.push(`The status changed, but the history entry could not be saved (${logError.message}).`);

    // Email the provider (queued; sent by the process-notifications function).
    let notified = false;
    if (action !== "under_review") {
      const message =
        action === "approve"
          ? "Good news — your StreetdocMD credentials have been verified and your provider badge is now active. Sign in to the provider app, set yourself as available, and you'll start receiving visit requests."
          : revoking
            ? `Your StreetdocMD provider verification has been suspended. Reason: ${notes}. Please contact contact@streetdocmd.com if you have questions.`
            : `Your StreetdocMD provider application needs attention. Reason: ${notes}. Sign in to the provider app to upload corrected documents and we'll review them again.`;
      const { error: notifyErr } = await admin.from("notifications_queue").insert({
        provider_id: params.id,
        channel: "email",
        subject: action === "approve" ? "You're verified on StreetdocMD" : "Update on your StreetdocMD verification",
        message,
        send_at: new Date().toISOString(),
        type: "provider_verification",
      });
      notified = !notifyErr;
      if (notifyErr) warnings.push(`The provider could not be notified automatically (${notifyErr.message}) — let them know directly.`);
    }

    return NextResponse.json({ ok: true, status: NEW_STATUS[action], notified, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
