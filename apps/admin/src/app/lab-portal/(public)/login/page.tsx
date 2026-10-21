import AuthShell from "@/components/portal/auth/AuthShell";
import LoginForm from "@/components/portal/auth/LoginForm";

export const metadata = { title: "Sign in · StreetdocMD Lab Partner Portal" };

export default function LabPortalLoginPage() {
  return <AuthShell type="lab"><LoginForm type="lab" /></AuthShell>;
}
