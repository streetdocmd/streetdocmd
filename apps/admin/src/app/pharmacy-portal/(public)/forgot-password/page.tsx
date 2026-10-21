import AuthShell from "@/components/portal/auth/AuthShell";
import ForgotPasswordForm from "@/components/portal/auth/ForgotPasswordForm";

export const metadata = { title: "Reset password · StreetdocMD Pharmacy Partner Portal" };

export default function PharmacyForgotPasswordPage() {
  return <AuthShell type="pharmacy"><ForgotPasswordForm type="pharmacy" /></AuthShell>;
}
