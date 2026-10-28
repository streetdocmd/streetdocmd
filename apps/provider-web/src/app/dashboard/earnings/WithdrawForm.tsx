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
}: {
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
      <div className="card p-5 border border-amber-200 bg-amber-50">
        <p className="text-sm font-medium text-amber-800 mb-1">Bank details required</p>
        <p className="text-sm text-amber-700 mb-3">
          Add your bank account in your profile before requesting a withdrawal.
        </p>
        <Link href="/dashboard/profile#payouts" className="btn-teal text-sm inline-block">
          Add bank details →
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card p-5 border border-green-200 bg-green-50 text-center">
        <p className="text-2xl mb-2">✓</p>
        <p className="font-semibold text-green-700">Withdrawal request submitted!</p>
        <p className="text-sm text-green-600 mt-1">We process payments every Friday. You'll be notified once it's done.</p>
        <button onClick={() => setSuccess(false)} className="mt-3 text-xs text-green-700 underline">
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
          {loading ? "Submitting…" : "Request Withdrawal"}
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