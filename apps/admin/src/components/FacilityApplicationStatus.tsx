import Link from "next/link";
import { Check, Clock, XCircle, MessageCircle, RefreshCw } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/components/portal/config";
import { ui } from "@/components/portal/ui";

export interface PendingApplication {
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
    .select("name, status, rejection_reason, facility_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.status === "approved") return null;
  return data as PendingApplication;
}

const PREPARE: Record<string, string[]> = {
  lab: [
    "Your MLSCN accreditation / operating licence and CAC certificate",
    "Your test menu with prices and turnaround times",
    "The phone number your sample collectors will use",
  ],
  pharmacy: [
    "Your PCN premises licence and CAC certificate",
    "Your stock list as a spreadsheet (you can import it as a CSV once approved)",
    "Your dispatch rider contact details",
  ],
  hospital: [
    "Your facility operating licence and CAC certificate",
    "A contact who will receive referrals and acknowledge them",
    "Your current specialties and bed availability",
  ],
};

// Shown on a partner portal to a facility that registered but isn't approved yet
export default function FacilityApplicationStatus({ app }: { app: PendingApplication }) {
  const rejected = app.status === "rejected";
  const submitted = app.created_at
    ? new Date(app.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const steps = [
    { label: "Application submitted", detail: submitted ? `Received ${submitted}` : "Received", state: "done" as const },
    rejected
      ? { label: "Review complete", detail: "Not approved", state: "failed" as const }
      : { label: "Under review", detail: "Usually within 48 hours", state: "current" as const },
    { label: "Portal unlocked", detail: "Start receiving patients", state: rejected ? ("skipped" as const) : ("todo" as const) },
  ];
  const prepare = PREPARE[app.facility_type ?? ""] ?? [];

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-5">
      <div className={`${ui.card} p-6 sm:p-8`}>
        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${rejected ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
          {rejected ? <XCircle size={24} aria-hidden /> : <Clock size={24} aria-hidden />}
        </span>
        <h1 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900">
          {rejected ? "Your application wasn't approved" : "Your application is under review"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {rejected
            ? <>We couldn&apos;t approve <strong>{app.name}</strong> to join the StreetdocMD partner network this time.</>
            : <>Thanks for registering <strong>{app.name}</strong>. Our partnerships team reviews applications within 48 hours and may call you to verify your documents. This portal unlocks automatically as soon as you&apos;re approved — just sign in again.</>}
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
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={ui.btnSecondary}>
            <MessageCircle size={15} aria-hidden /> WhatsApp us · {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
        {rejected && (
          <p className="mt-3 text-xs text-gray-500">
            Re-applying: use the same email and password you registered with, and we&apos;ll review the new application.
          </p>
        )}
      </div>

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
