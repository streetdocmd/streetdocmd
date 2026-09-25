// Every outbound link on the landing page lives here.
// Override any of them in Vercel → Settings → Environment Variables.
export const LINKS = {
  // Main booking web app (your patient app on its subdomain)
  bookWeb: process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://app.streetdocmd.com",
  // App Store / Play Store / smart link for the mobile app
  bookApp: process.env.NEXT_PUBLIC_MOBILE_APP_URL ?? "#",
  // Provider onboarding
  // Footer "Contact" link — change to your real inbox or a contact page
  contact: process.env.NEXT_PUBLIC_CONTACT_URL ?? "mailto:hello@streetdocmd.com",
  providerSignup: process.env.NEXT_PUBLIC_PROVIDER_URL ?? "https://provider.streetdocmd.com",

  patientTerms: process.env.NEXT_PUBLIC_PATIENT_TERMS_URL ?? "#",
  providerTerms: process.env.NEXT_PUBLIC_PROVIDER_TERMS_URL ?? "#",
  privacy: process.env.NEXT_PUBLIC_PRIVACY_URL ?? "#",
  facilityAgreement: process.env.NEXT_PUBLIC_FACILITY_AGREEMENT_URL ?? "#",

  x: process.env.NEXT_PUBLIC_X_URL ?? "#",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "#",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? "#",
};
