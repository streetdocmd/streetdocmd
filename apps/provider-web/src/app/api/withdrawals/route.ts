import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json();
  if (!amount || amount < 5000) {
    return NextResponse.json({ error: "Minimum withdrawal is ₦5,000" }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: provider } = await admin
    .from("providers")
    .select("id, wallet_balance, bank_name, bank_account_number, bank_account_name")
    .eq("user_id", user.id)
    .single();

  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  if (!provider.bank_name || !provider.bank_account_number) {
    return NextResponse.json({ error: "Bank details not set. Update your profile first." }, { status: 400 });
  }
  if (amount > provider.wallet_balance) {
    return NextResponse.json({ error: "Amount exceeds wallet balance" }, { status: 400 });
  }

  const { error } = await admin.from("withdrawals").insert({
    provider_id: provider.id,
    amount,
    bank_name: provider.bank_name,
    account_number: provider.bank_account_number,
    account_name: provider.bank_account_name ?? "",
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}