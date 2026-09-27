import { NextRequest, NextResponse } from "next/server";
import { PLATFORM_COMMISSION_RATE, PROVIDER_AGREEMENT_VERSION } from "@streetdocmd/shared";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// Records the Provider's click-to-accept of the Provider Service Agreement (clause 21).
// The timestamp and commission rate are set here on the server, never trusted from the client.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accepted, version } = await req.json().catch(() => ({}));
  if (accepted !== true) {
    return NextResponse.json({ error: "You must accept the Provider Service Agreement to continue." }, { status: 400 });
  }
  // The page may have been open across a deploy that changed the agreement
  if (version !== PROVIDER_AGREEMENT_VERSION) {
    return NextResponse.json(
      { error: "The Provider Service Agreement has been updated. Please refresh the page and review it again." },
      { status: 409 }
    );
  }

  const admin = createAdminSupabase();
  const { data: provider, error } = await admin
    .from("providers")
    .update({
      agreement_version: PROVIDER_AGREEMENT_VERSION,
      agreement_accepted_at: new Date().toISOString(),
      agreement_commission_rate: PLATFORM_COMMISSION_RATE * 100,
    })
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
