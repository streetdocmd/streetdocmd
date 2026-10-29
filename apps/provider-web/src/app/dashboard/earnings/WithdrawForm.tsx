"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNaira } from "@streetdocmd/shared";

export default function WithdrawForm({
  walletBalance,
  bankName,
  bankAccount,
  bankAccountName,
  payoutDay = "Friday",
}: {
  /** Day finance pays out (platform_settings.provider_payout_weekday) */
  payoutDay?: string;
  walletBalance: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const min = 5000;
  const hasBankDetails = bankName && bankAccount && bankAccountName;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num < min) { setError(`Minimum withdrawal is ${formatNaira(min)}.`); return; }
    if (num > walletBalance) { setError("Amount exceeds your wallet balance."); return; }
    if (loading) return;

    setLoading(true);
    setError("");
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: num }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Request failed. Please try again."); return; }
    setSuccess(true);
    setAmount("");
    router.refresh();
  }

  if (!hasBankDetails) {
    return (
      <div className="rounded-ds-lg bg-warn-bg p-5">
        <p className="mb-1 text-ds-sm font-bold text-ink">Bank details required</p>
        <p className="mb-3 text-ds-sm text-ink">
          Add your bank account in your profile before requesting a withdrawal.
        </p>
        <Link href="/dashboard/profile#payouts" className="btn-teal">
          Add bank details
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-ds-lg bg-success-bg p-5 text-center">
        <p className="font-bold text-success">Withdrawal requested</p>
        <p className="mt-1 text-ds-sm text-ink">We pay out every {payoutDay}. You&apos;ll be notified once it&apos;s sent.</p>
        <button onClick={() => setSuccess(false)} className="mt-3 text-ds-xs font-bold text-accent underline">
          Request another
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Withdraw to</p>
        <p className="text-sm text-ink mt-0.5 font-semibold">{bankAccountName}</p>
        <p className="text-xs text-muted">{bankName} · {bankAccount}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">
            Amount (max {formatNaira(walletBalance)})
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">₦</span>
            <input
              type="number"
              min={min}
              max={walletBalance}
              step="100"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="input pl-8"
              required
            />
          </div>
          <p className="text-xs text-muted mt-1">Minimum: {formatNaira(min)}</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || walletBalance < min}
          className="btn-teal w-full"
        >
          {loading ? "Submitting…" : "Withdraw to bank"}
        </button>

        {walletBalance < min && (
          <p className="text-xs text-center text-muted">
            Complete more visits to reach the {formatNaira(min)} minimum.
          </p>
        )}
      </form>
    </div>
  );
}