import AuthShell from "@/components/portal/auth/AuthShell";
import ResetPasswordForm from "@/components/portal/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password · StreetdocMD Hospital Partner Portal" };

export default function HospitalResetPasswordPage() {
  return <AuthShell type="hospital"><ResetPasswordForm type="hospital" /></AuthShell>;
}
