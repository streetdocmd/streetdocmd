"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, cx, focusRing } from "@/components/ds";
import LegalDocumentLink from "@/components/LegalDocumentLink";
import {
  COOKIE_SETTINGS_EVENT, GA_ID, clearAnalyticsCookies, loadAnalytics, pageView, readConsent, saveConsent, setTracking,
  type Consent,
} from "@/lib/analytics";

// Only the signed-out welcome, sign-up and sign-in pages are measured. Everything
// behind sign-in is health activity, so collection is switched off there.
// /reset-password is left out because its link carries a secret token.
const MEASURED = new Set(["/", "/register", "/login", "/forgot-password"]);

export default function CookieConsent() {
  const pathname = usePathname();
  const measured = MEASURED.has(pathname);
  const [choice, setChoice] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    const saved = readConsent();
    setChoice(saved);
    setOpen(saved === null);
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!GA_ID) return;
    setTracking(choice === "granted" && measured);
    if (choice === "granted" && measured) {
      loadAnalytics();
      pageView(pathname);
    }
  }, [choice, measured, pathname]);

  function decide(next: Consent) {
    saveConsent(next);
    if (next === "denied") { setTracking(false); clearAnalyticsCookies(); }
    setChoice(next);
    setOpen(false);
  }

  if (!GA_ID || !open || !measured) return null;
  return (
    <div role="region" aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-ds-lg border border-line bg-surface p-4 shadow-ds sm:inset-x-4 sm:bottom-4">
      <p className="text-ds-sm leading-relaxed text-ink">
        We&apos;d like to use Google Analytics cookies on these sign-up pages to understand how people find and join StreetdocMD.
        They&apos;re optional, never used after you sign in, and only set if you accept.{" "}
        <LegalDocumentLink slug="privacy-policy" className={cx("font-semibold text-accent underline-offset-2 hover:underline", focusRing)}>Privacy Policy</LegalDocumentLink>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" size="sm" onClick={() => decide("denied")}>Reject</Button>
        <Button size="sm" onClick={() => decide("granted")}>Accept</Button>
      </div>
    </div>
  );
}

/** Reopens the banner */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!GA_ID) return null;
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
      className={cx("text-ds-xs text-muted underline-offset-2 hover:underline", focusRing, className)}>
      Cookie settings
    </button>
  );
}
