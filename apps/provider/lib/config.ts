// Base URL of provider-web. The app calls its API for work that must run with
// the service role (registration). Override per environment with
// EXPO_PUBLIC_PROVIDER_PORTAL_URL, e.g. http://192.168.1.10:3003 in development.
export const PROVIDER_PORTAL_URL = (
  process.env.EXPO_PUBLIC_PROVIDER_PORTAL_URL ?? "https://provider.streetdocmd.com"
).replace(/\/+$/, "");
