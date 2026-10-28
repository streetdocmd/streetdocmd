import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Clock, FileText, XCircle, Search } from "lucide-react";
import { Notice, Pill } from "@/components/ds";
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

  // select("*"): review_status and review_note arrive with migration 062
  const { data: docs } = await supabase
    .from("provider_documents")
    .select("*")
    .eq("provider_id", provider.id)
    .order("uploaded_at", { ascending: false });
  const uploadedTypes = Array.from(new Set((docs ?? []).map(d => d.document_type as string)));
  // The latest upload of each type is the one being reviewed
  const latest = uploadedTypes.map(t => (docs ?? []).find(d => d.document_type === t)!) as any[];
  const needsInfo = latest.filter(d => d.review_status === "needs_info");

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
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-2">Your application needs changes</h1>
        <p className="text-muted text-sm mb-5 max-w-md mx-auto">
          Our team couldn&apos;t verify your application as submitted. Please review the note below,
          upload corrected documents and resubmit. We&apos;ll review it again within 24 to 48 hours.
        </p>
        <div className="rounded-ds-sm bg-danger-bg p-4 text-left mb-6">
          <p className="text-sm font-bold text-ink mb-1">Note from the verification team</p>
          <p className="text-sm text-ink">
            {provider.rejection_reason || "No reason was recorded. Please email contact@streetdocmd.com and we'll tell you what to change."}
          </p>
        </div>
        <Link href="/onboarding/documents" className="btn-primary inline-flex">
          Update documents and resubmit
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
        <div className="mb-3 flex justify-center">
          {needsInfo.length
            ? <Pill tone="warn">Needs info</Pill>
            : <Pill tone="idle" icon={Clock}>Under review</Pill>}
        </div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-2">
          {needsInfo.length
            ? `${needsInfo.length === 1 ? "One document needs" : `${needsInfo.length} documents need`} fixing`
            : inReview ? "Your credentials are being checked" : `Thanks, ${firstName}. Application received`}
        </h1>
        <p className="text-muted text-sm mb-6 max-w-md mx-auto">
          {inReview
            ? "A member of our team is verifying your licence with the issuing council. We'll email you as soon as it's done."
            : "Our team will verify your credentials, usually within 24–48 hours. We'll email you once your account is approved — then just sign in here to start receiving bookings."}
        </p>
      </div>

      <div className="card p-5 text-left space-y-3.5 mb-5">
        <Step state="done" label="Account created" />
        <Step state="done" label="Documents submitted and agreement accepted" />
        <Step state={inReview ? "current" : "next"} label={inReview ? "Verification in progress" : "Waiting for verification"} />
        <Step state="next" label="Account activated. Start receiving bookings" />
      </div>

      {needsInfo.length > 0 && (
        <Notice tone="warn" title="Fix the flagged document to resume review." className="mb-5">
          The reason sits next to it below. Upload a clear copy and we&apos;ll carry on.
        </Notice>
      )}

      {latest.length > 0 && (
        <div className="mb-5">
          <p className="mb-3 text-ds-sm font-bold text-navy">Your documents</p>
          <ul className="space-y-2.5">
            {latest.map(d => {
              const flagged = d.review_status === "needs_info";
              return (
                <li key={d.document_type}
                  className={`flex items-center gap-3 rounded-[18px] border bg-surface p-3.5 ${flagged ? "border-warn/50" : "border-line"}`}>
                  <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-page text-navy">
                    <FileText size={20} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-ds-sm text-ink">{DOC_LABELS[d.document_type] ?? d.document_type}</b>
                    <small className="block text-ds-xs text-muted">
                      {flagged ? d.review_note || "Please upload a clearer copy." : `Uploaded ${new Date(d.uploaded_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
                    </small>
                  </div>
                  {flagged ? (
                    <Link href="/onboarding/documents"
                      className="grid min-h-9 place-items-center rounded-xl border-[1.5px] border-dashed border-teal-deep px-3 text-ds-xs font-bold text-teal-deep">
                      Upload again
                    </Link>
                  ) : d.review_status === "approved" ? (
                    <Pill tone="ok" icon={Check}>Approved</Pill>
                  ) : (
                    <Pill tone="idle" icon={Clock}>In review</Pill>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-ds-xs text-muted">Your data is stored securely and used only for verification.</p>
        </div>
      )}

      <div className="rounded-xl bg-accent-soft border border-accent/40 p-4 text-sm text-ink">
        <p className="font-bold text-ink mb-1">While you wait</p>
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
