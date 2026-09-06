"use client";
import { useState } from "react";

export default function ReferralCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still visible to copy manually
    }
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Your patient code</p>
        <p className="text-2xl font-bold text-gray-900 tracking-widest mt-0.5">{code}</p>
        <p className="text-xs text-gray-400 mt-1">Share this so patients can book directly with you</p>
      </div>
      <button onClick={copy} className="btn-teal text-sm shrink-0">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
