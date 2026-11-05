// Google Analytics 4, loaded only after the visitor accepts (Privacy Policy
// section 13: non-essential analytics need an affirmative accept/reject choice).
// The choice is a cookie on .streetdocmd.com, so the website and the patient
// app share it. Nothing loads, and no banner shows, until the measurement ID
// is set in NEXT_PUBLIC_GA_MEASUREMENT_ID.
//
// Page views are sent by hand on route changes (send_page_view: false), so the
// GA data stream should have "Page changes based on browser history events"
// switched off; otherwise in-app navigation would be counted twice.

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const COOKIE_SETTINGS_EVENT = "sdm:cookie-settings";
const COOKIE = "sdm_analytics";
const MAX_AGE = 60 * 60 * 24 * 180;

export type Consent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function sharedDomain() {
  const host = location.hostname;
  return host === "streetdocmd.com" || host.endsWith(".streetdocmd.com") ? "; domain=.streetdocmd.com" : "";
}

export function readConsent(): Consent | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(granted|denied)`));
  return (m?.[1] as Consent) ?? null;
}

export function saveConsent(choice: Consent) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${choice}; max-age=${MAX_AGE}; path=/; samesite=lax${sharedDomain()}${secure}`;
}

let loaded = false;

export function loadAnalytics() {
  if (!GA_ID || loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag expects the arguments object itself, not an array
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

/** Google's documented switch for stopping all collection for this ID on the current page */
export function setTracking(enabled: boolean) {
  if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !enabled;
}

/** Removes Google Analytics cookies after someone changes their mind */
export function clearAnalyticsCookies() {
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name === "_ga" || name.startsWith("_ga_")) {
      for (const domain of ["", "; domain=.streetdocmd.com", `; domain=${location.hostname}`]) {
        document.cookie = `${name}=; max-age=0; path=/${domain}`;
      }
    }
  }
}

/** The path only: never query strings or fragments, which can carry tokens */
export function pageView(path: string) {
  window.gtag?.("event", "page_view", {
    page_location: location.origin + path,
    page_path: path,
    page_title: document.title,
  });
}

/** An event, sent only when the visitor has accepted. Never pass personal details. */
export function track(name: string, params?: Record<string, string | number>) {
  if (readConsent() === "granted") window.gtag?.("event", name, params ?? {});
}
