"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Activity, CalendarDays, Check, CreditCard, FileText, House, Landmark, Lock, Scale, ShieldCheck, Stethoscope, Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button, cx, focusRing } from "@/components/ds";

// Three promises, one per slide: the visit, the verification, the price.
// No personal data is asked for here; the account comes after.
interface Slide {
  title: string;
  body: string;
  icon: LucideIcon;
  floats: [LucideIcon, CSSProperties][];
}

const centreBottom: CSSProperties = { left: "50%", transform: "translateX(-50%)" };

const SLIDES: Slide[] = [
  {
    title: "A doctor at your door",
    body: "Book verified doctors, nurses and physiotherapists who come to your home in Ibadan and Lagos.",
    icon: House,
    floats: [
      [Stethoscope, { left: 22, top: 52 }],
      [CalendarDays, { right: 22, top: 76 }],
      [Activity, { ...centreBottom, bottom: 30 }],
    ],
  },
  {
    title: "Verified before every visit",
    body: "Each provider is checked with their licensing body before they can take your booking.",
    icon: ShieldCheck,
    floats: [
      [Check, { left: 24, top: 70 }],
      [Lock, { right: 26, top: 52 }],
      [FileText, { ...centreBottom, bottom: 32 }],
    ],
  },
  {
    title: "See the price before you pay",
    body: "Providers set their own fees. You see the full breakdown before any payment.",
    icon: CreditCard,
    floats: [
      [Scale, { left: 24, top: 60 }],
      [Landmark, { right: 24, top: 74 }],
      [Wallet, { ...centreBottom, bottom: 30 }],
    ],
  },
];

export default function Onboarding({ onFinish }: { onFinish: (href: "/register" | "/login") => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  const CentreIcon = slide.icon;

  return (
    <main className="min-h-[100dvh] bg-page">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pt-4 pb-6">
        <div className="flex items-center justify-between pt-2">
          <span className="text-ds-xs font-bold text-muted">
            {index + 1} of {SLIDES.length}
          </span>
          <button
            type="button"
            onClick={() => onFinish("/register")}
            className={cx("text-[13px] font-bold text-accent rounded-sm", focusRing)}
          >
            Skip
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-4" aria-hidden>
          <div
            className="relative aspect-square w-[300px] max-w-full rounded-full"
            style={{ background: "radial-gradient(circle at 30% 30%, var(--surface) 0%, var(--sky-mid) 60%, var(--sky-deep) 100%)" }}
          >
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-[124px] w-[124px] place-items-center rounded-[38px] bg-surface text-brand shadow-ds">
                <CentreIcon size={56} strokeWidth={2} />
              </div>
            </div>
            {slide.floats.map(([Icon, pos], i) => (
              <div
                key={`${index}-${i}`}
                className="absolute grid h-[70px] w-[70px] place-items-center rounded-[22px] bg-surface text-ink shadow-ds"
                style={pos}
              >
                <Icon size={30} strokeWidth={2} />
              </div>
            ))}
          </div>
        </div>

        <div aria-live="polite">
          <h1 className="mt-2 text-ds-2xl font-extrabold tracking-[-0.02em] text-navy">{slide.title}</h1>
          <p className="mt-2.5 text-ds-control text-muted">{slide.body}</p>
        </div>

        <div className="mt-[22px] mb-[18px] flex justify-center gap-1.5" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.title}
              className={cx("h-2 rounded transition-[width] duration-200", i === index ? "w-6 bg-accent" : "w-2 bg-line")}
            />
          ))}
        </div>

        <Button block size="lg" onClick={() => (last ? onFinish("/register") : setIndex(index + 1))}>
          {last ? "Get started" : "Next"}
        </Button>

        <p className="mt-3 text-center text-ds-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              onFinish("/login");
            }}
            className={cx("font-bold text-accent text-[13px] rounded-sm", focusRing)}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
