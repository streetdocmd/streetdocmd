import { Wallet } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira, PLATFORM_COMMISSION_RATE } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ApproveWithdrawalButton from "./ApproveWithdrawalButton";

export const dynamic = "force-dynamic";

async function getFinancials() {
  const supabase = createServerSupabase();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const startOfWeek = weekStart.toISOString();
  const startOfDay = new Date().toISOString().split("T")[0] + "T00:00:00";

  const [allTime, monthly, weekly, daily, pendingWithdrawals] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "successful"),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfMonth),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfWeek),
    supabase.from("payments").select("amount").eq("status", "successful").gte("created_at", startOfDay),
    supabase
      .from("withdrawals")
      .select("id, provider_id, amount, bank_name, account_number, account_name, requested_at, providers(name, wallet_balance)")
      .eq("status", "pending")
      .order("requested_at", { ascending: true }),
  ]);

  const sum = (data: { amount: number }[] | null) => (data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return {
    allTime: sum(allTime.data),
    monthly: sum(monthly.data),
    weekly: sum(weekly.data),
    daily: sum(daily.data),
    pendingWithdrawals: pendingWithdrawals.data ?? [],
  };
}

export default async function FinancePage() {
  const { allTime, monthly, weekly, daily, pendingWithdrawals } = await getFinancials();

  // Withdrawal requests don't reserve wallet balance, so a provider can request
  // more in total than they hold. Show both so admins can catch it.
  const pendingByProvider = new Map<string, number>();
  for (const w of pendingWithdrawals as any[]) {
    pendingByProvider.set(w.provider_id, (pendingByProvider.get(w.provider_id) ?? 0) + Number(w.amount ?? 0));
  }

  const revenueCards = [
    { label: "Today", sub: "Platform net", value: formatNaira(Math.round(daily * PLATFORM_COMMISSION_RATE)) },
    { label: "This week", sub: "Platform net", value: formatNaira(Math.round(weekly * PLATFORM_COMMISSION_RATE)) },
    { label: "This month", sub: "Total GMV", value: formatNaira(monthly) },
    { label: "All time", sub: "Total GMV", value: formatNaira(allTime) },
  ];

  return (
    <div>
      <PageHeader title="Finance" description="Revenue, platform commission and provider payouts." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {revenueCards.map(({ label, sub, value }) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-medium text-gray-500">{label} <span className="text-gray-400">· {sub}</span></p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Pending withdrawals <span className="ml-1 text-xs font-normal text-gray-400">({pendingWithdrawals.length})</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Oldest first. Approve only after the transfer has been made.</p>
        </div>
        {pendingWithdrawals.length === 0 ? (
          <EmptyState compact icon={Wallet} title="No pending withdrawals" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Provider</th><th>Amount</th><th>Wallet balance</th><th>Bank</th><th>Account</th><th>Requested</th><th className="text-right">Action</th></tr>
              </thead>
              <tbody>
                {pendingWithdrawals.map((w: any) => {
                  const prov = Array.isArray(w.providers) ? w.providers[0] : w.providers;
                  const providerName = prov?.name ?? "—";
                  const balance = prov?.wallet_balance != null ? Number(prov.wallet_balance) : null;
                  const pendingTotal = pendingByProvider.get(w.provider_id) ?? Number(w.amount);
                  const overdrawn = balance != null && pendingTotal > balance;
                  return (
                    <tr key={w.id}>
                      <td className="font-medium text-gray-900">{providerName}</td>
                      <td className="font-medium text-gray-900 whitespace-nowrap">{formatNaira(Number(w.amount))}</td>
                      <td className="whitespace-nowrap">
                        <span className={overdrawn ? "font-semibold text-red-600" : "text-gray-700"}>
                          {balance != null ? formatNaira(balance) : "—"}
                        </span>
                        {pendingTotal !== Number(w.amount) && (
                          <p className="text-xs text-gray-400">{formatNaira(pendingTotal)} pending in total</p>
                        )}
                        {overdrawn && <p className="text-xs text-red-600">Requests exceed balance</p>}
                      </td>
                      <td className="text-gray-600">{w.bank_name}</td>
                      <td className="text-gray-600">
                        <span className="font-mono text-xs">{w.account_number}</span> · {w.account_name}
                      </td>
                      <td className="text-gray-500 whitespace-nowrap">{new Date(w.requested_at).toLocaleDateString("en-NG")}</td>
                      <td className="text-right">
                        <ApproveWithdrawalButton
                          id={w.id}
                          warning={overdrawn ? `This provider's pending requests (${formatNaira(pendingTotal)}) exceed their wallet balance (${formatNaira(balance ?? 0)}).` : null}
                          summary={`${formatNaira(Number(w.amount))} to ${w.account_name} (${w.bank_name} ${w.account_number})`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
