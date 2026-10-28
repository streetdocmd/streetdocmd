import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";
import { Card, Pill, type PillTone } from "@/components/ds";
import WithdrawForm from "./WithdrawForm";

const WITHDRAWAL: Record<string, [string, PillTone]> = {
  pending: ["Requested", "idle"],
  approved: ["Approved", "info"],
  processed: ["Paid", "ok"],
  failed: ["Failed", "bad"],
};
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

function nextPayout(weekday: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const add = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function EarningsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from("providers")
    .select("id, wallet_balance, total_visits, completion_rate, bank_name, bank_account_number, bank_account_name")
    .eq("user_id", user!.id)
    .single();
  if (!provider) return null;

  const [{ data: allEarnings }, { data: withdrawals }, { data: active }, { data: payoutSetting }] = await Promise.all([
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
    // Visits accepted but not yet signed off: their payout lands once notes are submitted
    supabase.from("bookings").select("net_payout").eq("provider_id", provider.id).in("status", ACTIVE),
    supabase.from("platform_settings").select("value").eq("key", "provider_payout_weekday").maybeSingle(),
  ]);

  const earnings = allEarnings ?? [];
  const pending = (active ?? []).reduce((s, b) => s + Number(b.net_payout ?? 0), 0);
  const payoutWeekday = Number.isInteger(Number(payoutSetting?.value)) ? Number(payoutSetting!.value) : 5;
  const payoutDay = WEEKDAYS[payoutWeekday] ?? "Friday";
  const totalEarned = earnings.reduce((s, b) => s + Number(b.net_payout ?? 0), 0);

  // Recent activity: visit payouts in, withdrawals out, newest first
  const activity = [
    ...earnings.filter(b => b.completed_at).map(b => ({
      id: `b-${b.id}`, at: b.completed_at as string, title: sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? b.service_type),
      sub: `Visit ${b.id.slice(0, 8).toUpperCase()} · ${shortDate(b.completed_at as string)}`, amount: Number(b.net_payout), dir: "in" as const, pill: null,
    })),
    ...(withdrawals ?? []).map(w => ({
      id: `w-${w.id}`, at: w.requested_at as string, title: "Withdrawal to bank",
      sub: `${w.bank_name ?? "Bank"} ending ${String(w.account_number ?? "").slice(-4)} · ${shortDate(w.requested_at as string)}`,
      amount: Number(w.amount), dir: "out" as const, pill: WITHDRAWAL[w.status] ?? [w.status, "idle" as PillTone],
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);

  const hasBank = provider.bank_name && provider.bank_account_number;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Wallet</h1>
        <small className="text-[13px] font-semibold text-muted">Payouts every {payoutDay}</small>
      </div>

      <div className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_34px_rgba(0,127,115,0.22)]"
        style={{ background: "linear-gradient(140deg, var(--navy) 0%, var(--teal-deep) 100%)" }}>
        <small className="text-[13px] font-semibold text-teal-soft">Available to withdraw</small>
        <b className="mb-3.5 mt-1 block text-[34px] tracking-[-0.02em] tabular-nums">{formatNaira(provider.wallet_balance)}</b>
        <div className="flex gap-2.5">
          <div className="flex-1 rounded-[14px] bg-white/[0.12] px-3 py-2.5">
            <small className="text-[13px] font-semibold text-teal-soft">Pending sign off</small>
            <b className="block text-ds-control tabular-nums">{formatNaira(pending)}</b>
          </div>
          <div className="flex-1 rounded-[14px] bg-white/[0.12] px-3 py-2.5">
            <small className="text-[13px] font-semibold text-teal-soft">Next payout</small>
            <b className="block text-ds-control">{nextPayout(payoutWeekday)}</b>
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <WithdrawForm
          walletBalance={provider.wallet_balance}
          bankName={provider.bank_name}
          bankAccount={provider.bank_account_number}
          bankAccountName={provider.bank_account_name}
          payoutDay={payoutDay}
        />
      </div>

      {hasBank && (
        <Card className="mt-3.5 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <small className="text-ds-xs text-muted">Bank account</small>
              <div className="mt-0.5 font-bold text-ink">{provider.bank_name} · ending {String(provider.bank_account_number).slice(-4)}</div>
            </div>
            <Link href="/dashboard/profile#payouts" className="text-[13px] font-bold text-accent">Change</Link>
          </div>
        </Card>
      )}

      <section className="mt-[26px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-navy">Recent activity</h2>
          <span className="text-ds-sm text-muted">{formatNaira(totalEarned)} earned in total</span>
        </div>
        {activity.length ? (
          <Card padded={false} className="px-4 py-1">
            {activity.map(a => (
              <div key={a.id} className="flex items-center gap-3 border-b border-line py-[13px] last:border-b-0">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-ds-sm text-ink">{a.title}</b>
                  <small className="text-ds-xs text-muted">{a.sub}</small>
                </div>
                {a.pill && <Pill tone={a.pill[1]}>{a.pill[0]}</Pill>}
                <span className={`text-right text-ds-sm font-extrabold tabular-nums ${a.dir === "in" ? "text-success" : "text-navy"}`}>
                  {a.dir === "in" ? "+" : "−"}{formatNaira(a.amount)}
                </span>
              </div>
            ))}
          </Card>
        ) : (
          <div className="rounded-[20px] border border-dashed border-muted/40 bg-surface px-4 py-[18px] text-center text-ds-sm text-muted">
            Your payout for each visit appears here once its notes are submitted.
          </div>
        )}
      </section>

      <p className="mt-3.5 text-ds-xs text-muted">
        Patients pay a 5 percent service charge on top of your fee. StreetdocMD&apos;s commission comes out of your fee, and what you
        receive is shown on every request before you accept.
      </p>
    </div>
  );
}
