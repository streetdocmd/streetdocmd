"use client";
import { useState } from "react";
import { CreditCard, Landmark, Smartphone } from "lucide-react";
import { formatNaira } from "@/lib/shared";
import { Button, Notice } from "@/components/ds";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "./LegalAcceptanceFields";

const METHODS = [
  { label: "Card", icon: CreditCard },
  { label: "Bank transfer", icon: Landmark },
  { label: "USSD", icon: Smartphone },
];

// Review and pay footer, shared by booking and medicine order payments.
// Pay stays disabled until both legal boxes are ticked (they start unticked).
// The ticks only gate this button; acceptance itself was recorded at sign up.
export default function PayPanel({
  total,
  onPay,
  loading,
  loadingLabel,
  error,
  note,
}: {
  total: number;
  onPay: () => void;
  loading: boolean;
  loadingLabel: string;
  error?: string;
  /** What happens once payment is confirmed */
  note: string;
}) {
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const legalOk = legal.terms && legal.privacy;

  return (
    <>
      <section className="mt-[26px]">
        <h3 className="mb-3 text-[17px] font-bold text-navy">Pay with Paystack</h3>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map(({ label, icon: Icon }) => (
            <div key={label} className="grid min-h-16 place-items-center rounded-ds border-[1.5px] border-line bg-surface px-1 py-2 text-center text-[13px] font-bold text-ink">
              <span>
                <Icon size={20} className="mx-auto mb-1 text-navy" aria-hidden />
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-ds-xs text-muted">You choose how to pay in the secure Paystack window. {note}</p>
      </section>

      <div className="mt-[18px]">
        <LegalAcceptanceFields value={legal} onChange={setLegal} idPrefix="pay" />
      </div>

      {error && <Notice tone="danger" className="mt-3">{error}</Notice>}

      <div className="sticky bottom-[76px] z-20 mt-6 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
        <div className="flex items-center gap-3.5">
          <div>
            <small className="block text-ds-2xs font-bold text-muted">Total</small>
            <b className="text-[20px] tracking-[-0.01em] text-navy tabular-nums">{formatNaira(total)}</b>
          </div>
          <Button className="flex-1" onClick={onPay} disabled={loading || !legalOk} aria-busy={loading}>
            {loading ? loadingLabel : `Pay ${formatNaira(total)}`}
          </Button>
        </div>
        {!legalOk && !loading && <p className="mt-2 text-center text-ds-xs text-muted">Tick both boxes above to pay.</p>}
      </div>
    </>
  );
}
