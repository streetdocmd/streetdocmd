"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

    setLoading(true);
    setError("");
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: num }),
    });
    const json = await res.json();
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
        <a href="/dashboard/profile" className="btn-teal text-sm inline-block">
          Go to Profile →
        </a>
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
        <p className="text-sm font-medium text-gray-700">Withdraw to</p>
        <p className="text-sm text-gray-900 mt-0.5 font-semibold">{bankAccountName}</p>
        <p className="text-xs text-gray-400">{bankName} · {bankAccount}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Amount (max {formatNaira(walletBalance)})
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
            <input
              type="number"
              min={min}
              max={walletBalance}
              step="100"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-brand"
              required
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Minimum: {formatNaira(min)}</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || walletBalance < min}
          className="w-full py-2.5 bg-teal-brand text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Request Withdrawal"}
        </button>

        {walletBalance < min && (
          <p className="text-xs text-center text-gray-400">
            Complete more visits to reach the {formatNaira(min)} minimum.
          </p>
        )}
      </form>
    </div>
  );
}