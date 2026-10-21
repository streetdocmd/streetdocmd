import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess, ownsRecord } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// Moves a hospital may make on its own referrals, keyed by the new status.
const ALLOWED_FROM: Record<string, string[]> = {
  acknowledged: ["pending"],
  in_progress: ["acknowledged"],
  completed: ["acknowledged", "in_progress"],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getPortalApiAccess("hospital");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { status } = await req.json().catch(() => ({}));
  if (!ALLOWED_FROM[status]) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: referral } = await admin
    .from("hospital_referrals")
    .select("id, status, hospital_partner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!referral || !ownsRecord(auth.access, referral.hospital_partner_id)) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 });
  }
  if (!ALLOWED_FROM[status].includes(referral.status)) {
    return NextResponse.json({ error: "This referral has already moved on. Refresh the page to see its latest status." }, { status: 409 });
  }

  const { error } = await admin
    .from("hospital_referrals")
    .update({ status })
    .eq("id", params.id)
    .eq("status", referral.status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
