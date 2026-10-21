import AuthShell from "@/components/portal/auth/AuthShell";
import ForgotPasswordForm from "@/components/portal/auth/ForgotPasswordForm";

export const metadata = { title: "Reset password · StreetdocMD Lab Partner Portal" };

export default function LabForgotPasswordPage() {
  return <AuthShell type="lab"><ForgotPasswordForm type="lab" /></AuthShell>;
}
