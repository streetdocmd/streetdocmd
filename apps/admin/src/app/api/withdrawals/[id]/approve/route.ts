import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi();
    if ("response" in auth) return auth.response;
    const admin = createAdminSupabase();

    // Claim the withdrawal first (pending → processed) so a double-click or two
    // admins can never deduct the same withdrawal from the wallet twice.
    const { data: claimed, error: claimErr } = await admin
      .from("withdrawals")
      .update({ status: "processed", processed_by: auth.user.id, processed_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("status", "pending")
      .select("id, provider_id, amount");
    if (claimErr) return NextResponse.json({ error: `Could not update the withdrawal: ${claimErr.message}` }, { status: 500 });
    const withdrawal = claimed?.[0];
    if (!withdrawal) {
      return NextResponse.json({ error: "This withdrawal is no longer pending — it may already have been processed." }, { status: 409 });
    }

    const { error: walletErr } = await admin.rpc("increment_wallet", {
      p_provider_id: withdrawal.provider_id,
      p_amount: -withdrawal.amount,
    });
    if (walletErr) {
      await admin
        .from("withdrawals")
        .update({ status: "pending", processed_by: null, processed_at: null })
        .eq("id", params.id);
      return NextResponse.json({ error: `Could not deduct from the provider's wallet: ${walletErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected server error." }, { status: 500 });
  }
}
