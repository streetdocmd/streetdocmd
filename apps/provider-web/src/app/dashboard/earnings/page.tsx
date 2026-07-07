import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";
import WithdrawForm from "./WithdrawForm";

const WITHDRAWAL_STATUS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-blue-100 text-blue-700",
  processed: "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-700",
};

export default async function EarningsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from("providers")
    .select("id, wallet_balance, total_visits, completion_rate, bank_name, bank_account_number, bank_account_name")
    .eq("user_id", user!.id)
    .single();
  if (!provider) return null;

  const [{ data: allEarnings }, { data: withdrawals }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, net_payout, completed_at, service_type, fee")
      .eq("provider_id", provider.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
    supabase
      .from("withdrawals")
      .select("id, amount, status, bank_name, account_number, requested_at, processed_at")
      .eq("provider_id", provider.id)
      .order("requested_at", { ascending: false }),
  ]);

  const earnings = allEarnings ?? [];
  const totalEarned = earnings.reduce((sum, b) => sum + (b.net_payout ?? 0), 0);
  const totalWithdrawn = (withdrawals ?? [])
    .filter(w => w.status === "processed")
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5 text-center col-span-2 sm:col-span-1">
          <p className="text-3xl font-bold text-teal-brand">{formatNaira(provider.wallet_balance)}</p>
          <p className="text-sm text-gray-400 mt-1">Available balance</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{formatNaira(totalEarned)}</p>
          <p className="text-sm text-gray-400 mt-1">Total earned</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{provider.total_visits}</p>
          <p className="text-sm text-gray-400 mt-1">Total visits</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{formatNaira(totalWithdrawn)}</p>
          <p className="text-sm text-gray-400 mt-1">Total withdrawn</p>
        </div>
      </div>

      {/* Withdrawal request */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Request Withdrawal</h2>
        <WithdrawForm
          walletBalance={provider.wallet_balance}
          bankName={provider.bank_name}
          bankAccount={provider.bank_account_number}
          bankAccountName={provider.bank_account_name}
        />
      </div>

      {/* Withdrawal history */}
      {(withdrawals ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Withdrawal history</h2>
          <div className="space-y-2">
            {(withdrawals ?? []).map((w) => (
              <div key={w.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{formatNaira(w.amount)}</p>
                  <p className="text-xs text-gray-400">{w.bank_name} · {w.account_number}</p>
                  <p className="text-xs text-gray-400">
                    Requested {new Date(w.requested_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    {w.processed_at && ` · Paid ${new Date(w.processed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <span className={`badge ${WITHDRAWAL_STATUS[w.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earnings history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Completed visits ({earnings.length})
        </h2>
        {earnings.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-2">💰</p>
            <p className="font-semibold text-gray-700">No completed visits yet</p>
            <p className="text-sm text-gray-400 mt-1">Earnings appear here after each visit.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {earnings.map((b) => (
              <div key={b.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {(SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {b.completed_at
                      ? new Date(b.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-teal-brand">{formatNaira(b.net_payout)}</p>
                  <p className="text-xs text-gray-400">of {formatNaira(b.fee)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}