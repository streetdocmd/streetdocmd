import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@streetdocmd/shared";

export default async function EarningsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from("providers")
    .select("id, wallet_balance, total_visits, completion_rate")
    .eq("user_id", user!.id)
    .single();
  if (!provider) return null;

  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("id, amount, status, bank_name, account_number, requested_at, paid_at")
    .eq("provider_id", provider.id)
    .order("requested_at", { ascending: false });

  const { data: recentEarnings } = await supabase
    .from("bookings")
    .select("id, net_payout, completed_at, service_type")
    .eq("provider_id", provider.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10);

  const totalEarned = (recentEarnings ?? []).reduce((sum: number, b: any) => sum + (b.net_payout ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-teal-brand">{formatNaira(provider.wallet_balance)}</p>
          <p className="text-sm text-gray-400 mt-1">Wallet balance</p>
          <p className="text-xs text-gray-300 mt-0.5">Available for withdrawal</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{provider.total_visits}</p>
          <p className="text-sm text-gray-400 mt-1">Total visits</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{provider.completion_rate.toFixed(0)}%</p>
          <p className="text-sm text-gray-400 mt-1">Completion rate</p>
        </div>
      </div>

      {/* Withdrawal notice */}
      <div className="bg-blue-light border border-blue-mid rounded-xl p-4">
        <p className="text-sm text-blue-brand font-medium">Withdrawals</p>
        <p className="text-xs text-gray-500 mt-1">
          To request a withdrawal, please contact{" "}
          <a href="mailto:payments@streetdocmd.com" className="underline">payments@streetdocmd.com</a>{" "}
          or use the mobile app. Payments are processed every Friday.
        </p>
      </div>

      {/* Withdrawal history */}
      {(withdrawals ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Withdrawal history</h2>
          <div className="space-y-2">
            {(withdrawals ?? []).map((w: any) => (
              <div key={w.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{formatNaira(w.amount)}</p>
                  <p className="text-xs text-gray-400">{w.bank_name} · {w.account_number}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(w.requested_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`badge ${
                  w.status === "paid" ? "bg-green-100 text-green-700" :
                  w.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent earnings */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent completed visits</h2>
        {(recentEarnings ?? []).length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400 text-sm">No completed visits yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(recentEarnings ?? []).map((b: any) => (
              <div key={b.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{b.service_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-400">
                    {b.completed_at
                      ? new Date(b.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
                      : "—"}
                  </p>
                </div>
                <p className="font-bold text-teal-brand">{formatNaira(b.net_payout)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}