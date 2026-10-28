import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/components/portal/config";
import { ui } from "@/components/portal/ui";

export const metadata = { title: "Application Submitted — StreetdocMD" };

// Registration now signs the facility straight into its portal; this page
// remains for old links.
export default function FacilityRegSuccessPage({
  searchParams,
}: {
  searchParams: { email?: string; name?: string };
}) {
  const email = searchParams.email ?? "";
  const name  = searchParams.name  ?? "your facility";

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <CheckCircle2 size={56} className="mx-auto text-green-600" aria-hidden />
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Application submitted</h1>
          <p className="text-muted mt-2">Thank you for applying to join the StreetdocMD partner network.</p>
        </div>

        <div className={`${ui.card} p-5 text-left space-y-3`}>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="text-sm text-muted">
            Your application is under review. We&apos;ll contact you at{" "}
            {email ? <strong>{email}</strong> : "the email you provided"} within 48 hours. You can sign in to your
            partner portal at any time to check its status.
          </p>
          <p className="border-t border-line pt-3 text-xs text-muted">
            Questions? Email us at{" "}
            <a href={SUPPORT_MAILTO} className={ui.btnLink}>{SUPPORT_EMAIL}</a>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <Link href="/lab-portal/login" className={ui.btnSecondary}>Lab sign-in</Link>
          <Link href="/pharmacy-portal/login" className={ui.btnSecondary}>Pharmacy sign-in</Link>
          <Link href="/hospital-portal/login" className={ui.btnSecondary}>Hospital sign-in</Link>
        </div>
      </div>
    </div>
  );
}
