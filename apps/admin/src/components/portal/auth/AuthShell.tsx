import type { ReactNode } from "react";
import Image from "next/image";
import { FlaskConical, Pill, Hospital, ShieldCheck, Zap, Smartphone } from "lucide-react";
import { PORTALS, SUPPORT_WHATSAPP_URL, SUPPORT_PHONE_DISPLAY, type PortalType } from "../config";

const ICON = { lab: FlaskConical, pharmacy: Pill, hospital: Hospital };

const POINTS: Record<PortalType, string[]> = {
  lab: ["Investigation orders from doctors and patients", "Upload results that reach the patient instantly", "Manage your test menu and prices"],
  pharmacy: ["Digital prescriptions sent straight to you", "Paid-before-dispense orders, no chasing payments", "Keep inventory and prices in sync"],
  hospital: ["Referrals from StreetdocMD doctors", "Referral letters and urgency at a glance", "Acknowledge and track every referral"],
};

export default function AuthShell({ type, children }: { type: PortalType; children: ReactNode }) {
  const cfg = PORTALS[type];
  const Icon = ICON[type];
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-b from-navy-700 to-navy-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border-2 border-white" />
          <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full border-2 border-white" />
        </div>
        <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-8 w-auto relative self-start" priority />
        <div className="relative max-w-md">
          <span className="w-11 h-11 rounded-xl bg-white/10 text-white flex items-center justify-center mb-5">
            <Icon size={22} aria-hidden />
          </span>
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">{cfg.name}</p>
          <h1 className="text-3xl font-bold text-white leading-tight">Serve StreetdocMD patients from one simple workspace.</h1>
          <ul className="mt-8 space-y-3.5">
            {POINTS[type].map((p, i) => {
              const PointIcon = [Zap, ShieldCheck, Smartphone][i] ?? Zap;
              return (
                <li key={p} className="flex items-center gap-3 text-blue-100 text-sm">
                  <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><PointIcon size={14} aria-hidden /></span>
                  {p}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-blue-300/70 text-xs tracking-widest uppercase">Care. Anywhere. Anytime.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 shadow-card flex items-center justify-center overflow-hidden">
              <Image src="/mark.jpg" alt="" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <p className="text-lg font-bold text-navy-700 leading-tight">StreetdocMD</p>
              <p className="text-xs text-gray-500">{cfg.name}</p>
            </div>
          </div>
          {children}
          <p className="mt-8 text-xs text-gray-400 text-center">
            Need help? <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-blue-brand font-medium hover:underline">WhatsApp {SUPPORT_PHONE_DISPLAY}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
