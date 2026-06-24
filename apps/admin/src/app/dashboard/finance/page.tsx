import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@streetdocmd/shared";

async function getFinancials() {
  const supabase = createServerSupabase();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
  const startOfDay = new Date().toISOString().split("T")[0] + "T00:00:00";

  const [allTime, monthly, weekly, daily, pendingWithdrawals] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "successful"),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfMonth),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfWeek),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfDay),
    supabase.from("withdrawals").select("id, amount, bank_name, account_number, account_name, requested_at, providers(name)").eq("status", "pending"),
  ]);

  const sum = (data: { amount: number }[]) => data?.reduce((s, p) => s + p.amount, 0) ?? 0;
  const commission = (v: number) => v * 0.2;

  return {
    allTime: sum(allTime.data ?? []),
    monthly: sum(monthly.data ?? []),
    weekly: sum(weekly.data ?? []),
    daily: sum(daily.data ?? []),
    pendingWithdrawals: pendingWithdrawals.data ?? [],
  };
}

export default async function FinancePage() {
  const { allTime, monthly, weekly, daily, pendingWithdrawals } = await getFinancials();

  const revenueCards = [
    { label: "Today (Platform Net)", value: formatNaira(daily * 0.2) },
    { label: "This Week (Platform Net)", value: formatNaira(weekly * 0.2) },
    { label: "This Month (Total GMV)", value: formatNaira(monthly) },
    { label: "All Time (Total GMV)", value: formatNaira(allTime) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1>

      <div className="grid grid-cols-4 gap-4">
        {revenueCards.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Pending Withdrawals */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">
          Pending Withdrawals ({pendingWithdrawals.length})
        </h2>
        {pendingWithdrawals.length === 0 ? (
          <p className="text-sm text-gray-400">No pending withdrawals</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 uppercase text-xs border-b">
              <tr>
                <th className="text-left pb-2">Provider</th>
                <th className="text-left pb-2">Amount</th>
                <th className="text-left pb-2">Bank</th>
                <th className="text-left pb-2">Account</th>
                <th className="text-left pb-2">Requested</th>
                <th className="text-left pb-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingWithdrawals.map((w: any) => (
                <tr key={w.id}>
                  <td className="py-3 font-medium">{w.providers?.name}</td>
                  <td className="py-3">{formatNaira(w.amount)}</td>
                  <td className="py-3 text-gray-600">{w.bank_name}</td>
                  <td className="py-3 text-gray-600">{w.account_number} · {w.account_name}</td>
                  <td className="py-3 text-gray-400 text-xs">
                    {new Date(w.requested_at).toLocaleDateString("en-NG")}
                  </td>
                  <td className="py-3">
                    <form action={`/api/withdrawals/${w.id}/approve`} method="POST" className="inline">
                      <button className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700">
                        Approve
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
