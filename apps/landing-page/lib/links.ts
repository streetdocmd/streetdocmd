// Every outbound link on the landing page lives here.
// Override any of them in Vercel → Settings → Environment Variables.
export const LINKS = {
  // Main booking web app (your patient app on its subdomain)
  bookWeb: process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://app.streetdocmd.com",
  // App Store / Play Store / smart link for the mobile app
  bookApp: process.env.NEXT_PUBLIC_MOBILE_APP_URL ?? "#",
  // Provider onboarding
  // Footer "Contact" link — change to your real inbox or a contact page
  contact: process.env.NEXT_PUBLIC_CONTACT_URL ?? "mailto:contact@streetdocmd.com",
  providerSignup: process.env.NEXT_PUBLIC_PROVIDER_URL ?? "https://provider.streetdocmd.com",

  // Legal documents default to the pages on this site (same as LEGAL_PATHS in lib/legal;
  // literals here so the client-side Nav bundle never pulls in the legal text)
  patientTerms: process.env.NEXT_PUBLIC_PATIENT_TERMS_URL ?? "/terms",
  providerTerms: process.env.NEXT_PUBLIC_PROVIDER_TERMS_URL ?? "/provider-agreement",
  privacy: process.env.NEXT_PUBLIC_PRIVACY_URL ?? "/privacy",
  facilityAgreement: process.env.NEXT_PUBLIC_FACILITY_AGREEMENT_URL ?? "/facility-agreement",

  // Social links live in lib/brand.ts (SOCIAL_LINKS), shared with every StreetdocMD app.
};
