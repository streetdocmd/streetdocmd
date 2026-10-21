import AuthShell from "@/components/portal/auth/AuthShell";
import ResetPasswordForm from "@/components/portal/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password · StreetdocMD Pharmacy Partner Portal" };

export default function PharmacyResetPasswordPage() {
  return <AuthShell type="pharmacy"><ResetPasswordForm type="pharmacy" /></AuthShell>;
}
