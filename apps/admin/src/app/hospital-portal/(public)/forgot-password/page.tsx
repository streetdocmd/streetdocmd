import AuthShell from "@/components/portal/auth/AuthShell";
import ForgotPasswordForm from "@/components/portal/auth/ForgotPasswordForm";

export const metadata = { title: "Reset password · StreetdocMD Hospital Partner Portal" };

export default function HospitalForgotPasswordPage() {
  return <AuthShell type="hospital"><ForgotPasswordForm type="hospital" /></AuthShell>;
}
