import { SUPPORT_EMAIL } from "@/lib/brand";

// Sign in and sign up screens point to email support; the WhatsApp concierge is
// for people already using the app.
export default function AuthHelp() {
  return (
    <p className="mt-8 text-center text-ds-xs text-muted">
      Trouble signing in or creating an account? Contact{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-accent hover:underline">{SUPPORT_EMAIL}</a>
    </p>
  );
}
