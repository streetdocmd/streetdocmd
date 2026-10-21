import AuthShell from "@/components/portal/auth/AuthShell";
import ResetPasswordForm from "@/components/portal/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password · StreetdocMD Lab Partner Portal" };

export default function LabResetPasswordPage() {
  return <AuthShell type="lab"><ResetPasswordForm type="lab" /></AuthShell>;
}
