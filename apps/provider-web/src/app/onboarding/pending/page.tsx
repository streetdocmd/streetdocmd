import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Clock, XCircle, Search } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { DOC_LABELS, onboardingRoute } from "@/lib/onboarding";
import OnboardingSteps from "@/components/OnboardingSteps";

export default async function PendingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) redirect("/register/individual");

  const { data: docs } = await supabase
    .from("provider_documents")
    .select("document_type, uploaded_at")
    .eq("provider_id", provider.id)
    .order("uploaded_at", { ascending: false });
  const uploadedTypes = Array.from(new Set((docs ?? []).map(d => d.document_type as string)));

  const target = onboardingRoute(provider, uploadedTypes);
  if (target !== "/onboarding/pending") redirect(target);

  const status = provider.verification_status as string;
  const isRejected = status === "rejected";
  const inReview = status === "under_review";
  const firstName = (provider.name as string).replace(/^(dr|mr|mrs|ms|nurse)\.?\s+/i, "").split(" ")[0];

  if (isRejected) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy tracking-tight mb-2">Your application needs changes</h1>
        <p className="text-muted text-sm mb-5 max-w-md mx-auto">
          Our team couldn&apos;t verify your application as submitted. Please review the note below,
          upload corrected documents and re-submit — we&apos;ll review it again within 24–48 hours.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left mb-6">
          <p className="text-sm font-semibold text-red-700 mb-1">Note from the verification team</p>
          <p className="text-sm text-red-600">
            {provider.rejection_reason || "No reason was recorded. Please email contact@streetdocmd.com and we'll tell you what to change."}
          </p>
        </div>
        <Link href="/onboarding/documents" className="btn-primary inline-flex">
          Update documents & re-submit
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <OnboardingSteps current={2} />
      </div>

      <div className="text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          {inReview ? <Search size={30} className="text-amber-600" /> : <Clock size={30} className="text-amber-600" />}
        </div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy tracking-tight mb-2">
          {inReview ? "Your credentials are being checked" : `Thanks, ${firstName} — application received`}
        </h1>
        <p className="text-muted text-sm mb-6 max-w-md mx-auto">
          {inReview
            ? "A member of our team is verifying your licence with the issuing council. We'll email you as soon as it's done."
            : "Our team will verify your credentials, usually within 24–48 hours. We'll email you once your account is approved — then just sign in here to start receiving bookings."}
        </p>
      </div>

      <div className="card p-5 text-left space-y-3.5 mb-5">
        <Step state="done" label="Account created" />
        <Step state="done" label="Documents submitted & agreement accepted" />
        <Step state={inReview ? "current" : "next"} label={inReview ? "Verification in progress" : "Waiting for verification"} />
        <Step state="next" label="Account activated — start receiving bookings" />
      </div>

      {(docs ?? []).length > 0 && (
        <div className="card p-5 mb-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">What you sent us</p>
          <ul className="space-y-2">
            {uploadedTypes.map(t => (
              <li key={t} className="flex items-center gap-2 text-sm text-ink">
                <Check size={15} className="text-green-600 shrink-0" />
                {DOC_LABELS[t] ?? t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-accent-soft border border-accent/40 p-4 text-sm text-ink">
        <p className="font-semibold text-ink mb-1">While you wait</p>
        <p>
          Once you&apos;re approved, have your bank details and working hours ready — you&apos;ll add them on your
          profile so payouts and bookings can start straight away.
        </p>
      </div>
    </div>
  );
}

function Step({ state, label }: { state: "done" | "current" | "next"; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          state === "done" ? "bg-green-100 text-green-700"
            : state === "current" ? "bg-amber-100 text-amber-700"
            : "bg-pending-bg text-muted"
        }`}
      >
        {state === "done" ? <Check size={13} strokeWidth={3} /> : state === "current" ? <Clock size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      </div>
      <span className={`text-sm ${state === "next" ? "text-muted" : "text-ink font-medium"}`}>{label}</span>
    </div>
  );
}
