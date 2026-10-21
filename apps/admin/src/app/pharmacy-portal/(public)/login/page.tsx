import AuthShell from "@/components/portal/auth/AuthShell";
import LoginForm from "@/components/portal/auth/LoginForm";

export const metadata = { title: "Sign in · StreetdocMD Pharmacy Partner Portal" };

export default function PharmacyPortalLoginPage() {
  return <AuthShell type="pharmacy"><LoginForm type="pharmacy" /></AuthShell>;
}
