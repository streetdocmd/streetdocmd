import AuthShell from "@/components/portal/auth/AuthShell";
import LoginForm from "@/components/portal/auth/LoginForm";

export const metadata = { title: "Sign in · StreetdocMD Hospital Partner Portal" };

export default function HospitalPortalLoginPage() {
  return <AuthShell type="hospital"><LoginForm type="hospital" /></AuthShell>;
}
