import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { DOC_LABELS, hasCurrentAgreement, missingDocTypes } from "@/lib/onboarding";

// Final step of the documents form: confirms the application is complete
// (every required document on file + current agreement accepted) and, for a
// previously-rejected provider, puts them back into the admin review queue.
export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const { data: docs } = await admin
    .from("provider_documents")
    .select("document_type, uploaded_at")
    .eq("provider_id", provider.id);

  const missing = missingDocTypes(provider.specialty, (docs ?? []).map(d => d.document_type));
  if (missing.length > 0) {
    return NextResponse.json({
      error: `Please upload your ${missing.map(t => DOC_LABELS[t] ?? t).join(" and ")}.`,
    }, { status: 400 });
  }
  if (!hasCurrentAgreement(provider.agreement_version)) {
    return NextResponse.json({ error: "Please accept the Provider Service Agreement to continue." }, { status: 400 });
  }

  if (provider.verification_status === "rejected") {
    // Re-applying needs at least one document uploaded since the rejection.
    const { data: lastRejection } = await admin
      .from("verification_logs")
      .select("created_at")
      .eq("provider_id", provider.id)
      .eq("action", "rejected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRejection && !(docs ?? []).some(d => new Date(d.uploaded_at) > new Date(lastRejection.created_at))) {
      return NextResponse.json({ error: "Please upload at least one corrected document before re-submitting." }, { status: 400 });
    }

    const { error } = await admin
      .from("providers")
      .update({ verification_status: "pending", rejection_reason: null })
      .eq("id", provider.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
