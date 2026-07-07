import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const admin = createAdminSupabase();

  const { data: withdrawal } = await admin
    .from("withdrawals")
    .select("id, provider_id, amount, status")
    .eq("id", params.id)
    .single();

  if (withdrawal?.status !== "pending") {
    return NextResponse.redirect(new URL("/dashboard/finance", req.url));
  }

  // Deduct from provider wallet
  await admin.rpc("increment_wallet", {
    p_provider_id: withdrawal.provider_id,
    p_amount: -withdrawal.amount,
  });

  await admin
    .from("withdrawals")
    .update({
      status: "processed",
      processed_by: user.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  return NextResponse.redirect(new URL("/dashboard/finance", req.url));
}