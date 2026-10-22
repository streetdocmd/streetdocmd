import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal-acceptance";

// An existing patient accepting the current Patient Terms of Service and
// acknowledging the current Privacy Policy (PolicyUpdateBanner). Runs the
// record_patient_legal_acceptance RPC as the signed-in patient, so the
// accepting account comes from the session and the timestamp from the DB.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  if (body.acceptTerms !== true || body.acknowledgePrivacy !== true) {
    return NextResponse.json({
      error: "Please agree to the Terms of Service and acknowledge the Privacy Policy to continue.",
    }, { status: 400 });
  }
  if (body.termsVersion !== TERMS_VERSION || body.privacyVersion !== PRIVACY_VERSION) {
    return NextResponse.json({
      error: "These documents have been updated since you opened them. Please refresh the page and review them again.",
    }, { status: 409 });
  }

  const { data, error } = await supabase.rpc("record_patient_legal_acceptance", {
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_context: "reaccept",
  });
  if (error) {
    console.error("[legal/accept] record_patient_legal_acceptance failed:", error);
    return NextResponse.json({ error: "We couldn't save your acceptance. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, acceptedAt: data });
}
