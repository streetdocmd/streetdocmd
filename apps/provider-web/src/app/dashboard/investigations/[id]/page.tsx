import { notFound, redirect } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Button, Card, Pill, TopBar } from "@/components/ds";
import { NEXT_STEP_LABEL, RESULT_STATUSES, statusOf } from "@/lib/investigation-status";
import ReviewForm from "./ReviewForm";
import CompleteButton from "./CompleteButton";

export const dynamic = "force-dynamic";

const FLAG_LABEL: Record<string, string> = { high: "High", low: "Low", critical: "Critical" };
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }) : null;

// An investigation the doctor ordered (migration 067): its progress, the
// results once uploaded, and their review.
export default async function DoctorInvestigationPage({ params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("*, users!patient_id(name, dob), lab_partners(name), investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order || !provider || order.provider_id !== provider.id) notFound();

  const patient = order.users as any;
  const age = patient?.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86_400_000)) : null;
  const tests: any[] = Array.isArray(order.tests) ? order.tests : [];
  const results: any[] = (order.investigation_results as any[]) ?? [];
  const hasResults = (RESULT_STATUSES as string[]).includes(order.status);
  const st = statusOf(order.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <TopBar title="Investigation" backHref={order.patient_id ? `/dashboard/patients/${order.patient_id}` : "/dashboard"} className="-mx-5 -mt-2 md:mx-0" />

      <div>
        <Pill tone={st.tone}>{st.label}</Pill>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{tests.map(t => t.test_name).join(", ")}</h1>
        <p className="mt-1 text-ds-sm text-muted">
          {[patient?.name, age != null ? `${age} years` : null, (order.lab_partners as any)?.name, `ordered ${when(order.ordered_at)}`].filter(Boolean).join(" · ")}
        </p>
        {order.clinical_notes && <p className="mt-1.5 text-ds-sm text-ink/85">Indication: {order.clinical_notes}</p>}
      </div>

      {order.has_critical && hasResults && (
        <div className="flex items-start gap-2.5 rounded-ds bg-danger-bg p-3.5 text-ds-sm font-semibold text-danger">
          <AlertTriangle size={18} className="mt-0.5 flex-none" aria-hidden />
          The lab marked a result as critical. Contact the patient promptly.
        </div>
      )}

      {!hasResults ? (
        <Card>
          <p className="text-ds-sm text-muted">
            {order.status === "awaiting_patient_approval" ? "Waiting for the patient to approve and pay."
              : order.status === "declined_by_patient" ? "The patient declined these tests."
              : "Results will appear here when the lab uploads them. You'll be notified."}
          </p>
        </Card>
      ) : (
        <>
          <Card padded={false} className="px-4 py-1">
            {results.filter(r => r.result_value).length === 0 ? (
              <p className="py-4 text-ds-sm text-muted">The lab attached its results as a report.</p>
            ) : results.filter(r => r.result_value).map(r => (
              <div key={r.id} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
                <div className="min-w-0">
                  <b className="block text-ds-sm text-ink">{r.test_name}</b>
                  {r.reference_range && <small className="text-ds-xs text-muted">Reference: {r.reference_range}</small>}
                </div>
                <div className="text-right">
                  <b className="block text-ds-sm text-ink tabular-nums">{r.result_value}{r.unit ? ` ${r.unit}` : ""}</b>
                  {FLAG_LABEL[r.flag] && <Pill tone={r.flag === "critical" ? "bad" : "warn"}>{FLAG_LABEL[r.flag]}</Pill>}
                </div>
              </div>
            ))}
          </Card>
          {results.some(r => r.result_pdf_url) && (
            <Button href={`/api/investigations/${order.id}/file`} variant="secondary" target="_blank" rel="noopener noreferrer">
              <FileText size={18} aria-hidden /> Open the lab report
            </Button>
          )}

          {order.status === "doctor_review_pending" ? (
            <Card>
              <h2 className="mb-3 text-ds-control font-bold text-navy">Your review</h2>
              <ReviewForm orderId={order.id} />
            </Card>
          ) : order.reviewed_at && (
            <Card className="space-y-2">
              <p className="text-ds-sm font-bold text-navy">Your review · {when(order.reviewed_at)}</p>
              <p className="text-ds-sm text-ink/90">{order.review_interpretation}</p>
              {order.review_next_step && <p className="text-ds-sm"><b>Next step:</b> {NEXT_STEP_LABEL[order.review_next_step]}</p>}
              {order.review_notes && <p className="text-ds-sm text-ink/90">{order.review_notes}</p>}
              {(order.status === "follow_up_required" || order.status === "reviewed") && <CompleteButton orderId={order.id} />}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
