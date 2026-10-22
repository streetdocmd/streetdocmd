import Link from "next/link";
import { Check, Clock, XCircle, Mail, RefreshCw, FileUp } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/components/portal/config";
import { ui } from "@/components/portal/ui";
import FacilityDocumentsUpload from "@/components/portal/FacilityDocumentsUpload";
import { isMissingTableError, missingFacilityDocs, type FacilityDocument } from "@/lib/facility-docs";
import FacilityAgreementPrompt from "@/components/legal/FacilityAgreementPrompt";
import FacilityAgreementRecord from "@/components/legal/FacilityAgreementRecord";
import { agreementState } from "@/lib/facility-agreement";
import { getFacilityAgreementRecord } from "@/lib/facility-agreement-server";

export interface PendingApplication {
  id: string;
  name: string;
  status: string;
  rejection_reason: string | null;
  facility_type: string | null;
  created_at: string | null;
}

/**
 * The signed-in user's latest facility application, if it isn't approved.
 * Only the latest one counts: a facility that was rejected and re-applied
 * is judged on the new application.
 */
export async function getUnapprovedApplication(userId: string): Promise<PendingApplication | null> {
  const { data } = await createAdminSupabase()
    .from("facility_applications")
    .select("id, name, status, rejection_reason, facility_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.status === "approved") return null;
  return data as PendingApplication;
}

/** Documents uploaded to this application (service role; caller has already resolved ownership). */
async function getApplicationDocuments(applicationId: string): Promise<{ docs: FacilityDocument[]; unavailable: boolean }> {
  const { data, error } = await createAdminSupabase()
    .from("facility_documents")
    .select("id, document_type, file_name, uploaded_at")
    .eq("application_id", applicationId)
    .order("uploaded_at", { ascending: true });
  if (error) {
    if (!isMissingTableError(error)) console.error("facility documents: load failed:", error);
    return { docs: [], unavailable: isMissingTableError(error) };
  }
  return { docs: (data ?? []) as FacilityDocument[], unavailable: false };
}

const PREPARE: Record<string, string[]> = {
  lab: [
    "Your test menu with prices and turnaround times",
    "The phone number your sample collectors will use",
  ],
  pharmacy: [
    "Your stock list as a spreadsheet (you can import it as a CSV once approved)",
    "Your dispatch rider contact details",
  ],
  hospital: [
    "A contact who will receive referrals and acknowledge them",
    "Your current specialties and bed availability",
  ],
};

// Shown on a partner portal to a facility that registered but isn't approved yet
export default async function FacilityApplicationStatus({ app, userId, userName }: {
  app: PendingApplication;
  /** The signed-in applicant (already verified by the portal guard). */
  userId: string;
  userName?: string | null;
}) {
  const rejected = app.status === "rejected";
  const agreement = rejected ? null : await getFacilityAgreementRecord(userId);
  // Only the application shown here; never a different (older) one.
  const agreementRecord = agreement && agreement.applicationId === app.id ? agreement : null;
  const submitted = app.created_at
    ? new Date(app.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const { docs, unavailable } = rejected ? { docs: [], unavailable: false } : await getApplicationDocuments(app.id);
  const missing = missingFacilityDocs(app.facility_type, docs.map((d) => d.document_type));
  const docsComplete = !unavailable && missing.length === 0;

  type StepState = "done" | "current" | "failed" | "todo" | "skipped";
  const steps: { label: string; detail: string; state: StepState }[] = rejected
    ? [
        { label: "Application submitted", detail: submitted ? `Received ${submitted}` : "Received", state: "done" },
        { label: "Review complete", detail: "Not approved", state: "failed" },
        { label: "Portal unlocked", detail: "Start receiving patients", state: "skipped" },
      ]
    : [
        { label: "Application submitted", detail: submitted ? `Received ${submitted}` : "Received", state: "done" },
        docsComplete
          ? { label: "Documents uploaded", detail: "All required documents received", state: "done" }
          : { label: "Upload your documents", detail: `${missing.length} required document${missing.length === 1 ? "" : "s"} still needed — upload them below`, state: "current" },
        { label: "Manual review", detail: "We verify your documents, usually within 48 hours", state: docsComplete ? "current" : "todo" },
        { label: "Portal unlocked", detail: "Start receiving patients", state: "todo" },
      ];
  const prepare = PREPARE[app.facility_type ?? ""] ?? [];

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-5">
      <div className={`${ui.card} p-6 sm:p-8`}>
        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${rejected ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
          {rejected ? <XCircle size={24} aria-hidden /> : <Clock size={24} aria-hidden />}
        </span>
        <h1 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900">
          {rejected ? "Your application wasn't approved" : docsComplete ? "Your application is under review" : "Upload your documents to continue"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {rejected
            ? <>We couldn&apos;t approve <strong>{app.name}</strong> to join the StreetdocMD partner network this time.</>
            : docsComplete
              ? <>Thanks — we have everything we need for <strong>{app.name}</strong>. Our partnerships team reviews your documents manually, usually within 48 hours, and may call you to confirm details. This portal unlocks automatically as soon as you&apos;re approved — just sign in again.</>
              : <>Thanks for registering <strong>{app.name}</strong>. To verify your facility, upload the documents listed below. Our partnerships team reviews them manually, and this portal unlocks automatically as soon as you&apos;re approved.</>}
        </p>

        {rejected && app.rejection_reason && (
          <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold mb-0.5">Reason given</p>
            {app.rejection_reason}
          </div>
        )}

        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  s.state === "done" ? "bg-green-600 text-white"
                  : s.state === "current" ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
                  : s.state === "failed" ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.state === "done" ? <Check size={13} aria-hidden /> : s.state === "failed" ? <XCircle size={13} aria-hidden /> : i + 1}
              </span>
              <div>
                <p className={`text-sm font-semibold ${s.state === "todo" || s.state === "skipped" ? "text-gray-400" : "text-gray-900"}`}>{s.label}</p>
                <p className="text-xs text-gray-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col sm:flex-row gap-2">
          {rejected && (
            <Link href={`/register/facility?type=${app.facility_type ?? ""}`} className={ui.btnPrimary}>
              <RefreshCw size={15} aria-hidden /> Re-apply with updated details
            </Link>
          )}
          <a href={SUPPORT_MAILTO} className={ui.btnSecondary}>
            <Mail size={15} aria-hidden /> Email {SUPPORT_EMAIL}
          </a>
        </div>
        {rejected && (
          <p className="mt-3 text-xs text-gray-500">
            Re-applying: use the same email and password you registered with. After you re-apply, sign in here again to
            upload your verification documents for the new application.
          </p>
        )}
      </div>

      {agreementRecord && (
        agreementState(agreementRecord) === "accepted" ? (
          <div className={`${ui.card} p-5 sm:p-6`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Your partner agreement</h2>
            <FacilityAgreementRecord
              version={agreementRecord.version}
              acceptedAt={agreementRecord.acceptedAt}
              acceptedName={agreementRecord.acceptedName}
            />
          </div>
        ) : (
          <FacilityAgreementPrompt record={agreementRecord} defaultName={userName} />
        )
      )}

      {!rejected && (
        <div id="documents">
          {!docsComplete && !unavailable && (
            <p className="mb-2 px-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <FileUp size={13} aria-hidden /> Step 2 of 4 — upload your documents
            </p>
          )}
          <FacilityDocumentsUpload facilityType={app.facility_type} initialDocuments={docs} unavailable={unavailable} />
        </div>
      )}

      {!rejected && prepare.length > 0 && (
        <div className={`${ui.card} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900">Get ready while you wait</h2>
          <p className="text-xs text-gray-500 mt-0.5">Having these to hand speeds up verification and your first day on the network.</p>
          <ul className="mt-4 space-y-2.5">
            {prepare.map(p => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check size={16} className="text-blue-brand mt-0.5 shrink-0" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
