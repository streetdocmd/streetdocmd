"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LINKS } from "@/lib/links";
import {
  COOKIE_SETTINGS_EVENT, GA_ID, clearAnalyticsCookies, loadAnalytics, pageView, readConsent, saveConsent, setTracking,
  type Consent,
} from "@/lib/analytics";

// The cookie banner and Google Analytics for the website. Accept and Reject get
// equal weight; nothing loads until Accept. "Cookie settings" in the footer reopens it.
export default function CookieConsent() {
  const pathname = usePathname();
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
    if (choice !== "granted") return;
    loadAnalytics();
    setTracking(true);
    pageView(pathname);
  }, [choice, pathname]);

  function decide(next: Consent) {
    saveConsent(next);
    if (next === "denied") { setTracking(false); clearAnalyticsCookies(); }
    setChoice(next);
    setOpen(false);
  }

  if (!GA_ID || !open) return null;
  return (
    <div className="cookie-banner" role="region" aria-label="Cookie choices">
      <p>
        We&apos;d like to use Google Analytics cookies to understand how people use our website, so we can improve it.
        They&apos;re optional and only set if you accept. <a href={`${LINKS.privacy}#section-cookies`}>Privacy Policy</a>
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn btn-outline" onClick={() => decide("denied")}>Reject</button>
        <button type="button" className="btn btn-primary" onClick={() => decide("granted")}>Accept</button>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner */
export function CookieSettingsLink() {
  if (!GA_ID) return null;
  return (
    <button type="button" className="footer-cookie-link" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>
      Cookie settings
    </button>
  );
}
