import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Check, FileText, FlaskConical, Info, MapPin, Stethoscope } from "lucide-react";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Button, Card, Notice, Pill, TopBar, cx } from "@/components/ds";
import { formatNaira } from "@/lib/shared";
import { INVESTIGATION_STATUS, NEXT_STEP_LABEL, RESULT_STATUSES, TIMELINE, WINDOW_LABEL, statusOf, timelineIndex } from "@/lib/investigation-status";
import { transition } from "@/lib/investigations";
import CheckoutPanel from "./CheckoutPanel";
import ShareResults from "./ShareResults";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";

const FLAG_LABEL: Record<string, string> = { high: "High", low: "Low", critical: "Critical" };
const CHECKOUT = ["draft", "awaiting_patient_approval", "awaiting_payment", "payment_failed"];
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }) : null;

// One page for every investigation, whoever started it (migration 067):
// approve and pay, follow collection and the lab, read results and the
// doctor's notes, share results, and book a clinician.
export default async function InvestigationPage({ params, searchParams }: { params: { id: string }; searchParams: { paid?: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("investigation_orders")
    .select("*, lab_partners(name, phone), providers(name), investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: events }, { data: me }, { data: rated }] = await Promise.all([
    admin.from("investigation_order_events").select("to_status, created_at").eq("order_id", order.id).order("created_at"),
    admin.from("users").select("phone").eq("id", user.id).maybeSingle(),
    admin.from("facility_reviews").select("id").eq("facility_type", "lab").eq("order_id", order.id).maybeSingle(),
  ]);

  const status = order.status as string;
  const hasResults = (RESULT_STATUSES as string[]).includes(status);

  // A self-service order is complete once the patient has seen the results
  if (hasResults && order.requested_by === "patient" && status === "results_uploaded") {
    await admin.from("investigation_orders").update({ patient_viewed_at: order.patient_viewed_at ?? new Date().toISOString() }).eq("id", order.id);
    await transition(admin, order.id, "completed", user.id, "patient", "Patient viewed the results");
  }

  const tests: any[] = Array.isArray(order.tests) ? order.tests : [];
  const results: any[] = (order.investigation_results as any[]) ?? [];
  const hasReport = results.some(r => r.result_pdf_url);
  const fromDoctor = order.requested_by === "provider";
  const doctorName = (order.providers as any)?.name as string | undefined;
  const lab = order.lab_partners as any;
  const st = statusOf(status);
  const stepAt = timelineIndex(status);
  const reachedAt = (statuses: string[]) => (events ?? []).find(e => statuses.includes(e.to_status))?.created_at ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <TopBar title="Lab tests" backHref="/dashboard/my-care" className="-mx-5 -mt-2 md:mx-0" />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={st.tone}>{st.label}</Pill>
          {fromDoctor && doctorName && <span className="text-ds-sm text-muted">Requested by Dr {doctorName}</span>}
        </div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">
          {tests.map(t => t.test_name).join(", ") || "Lab tests"}
        </h1>
        {order.clinical_notes && fromDoctor && <p className="mt-1.5 text-ds-sm text-muted">Reason: {order.clinical_notes}</p>}
      </div>

      {/* Before payment */}
      {CHECKOUT.includes(status) && (
        <>
          {searchParams.paid && status === "awaiting_payment" ? (
            <>
              <Notice tone="info">Confirming your payment with Paystack. This page updates by itself.</Notice>
              <AutoRefresh />
            </>
          ) : status === "payment_failed" ? (
            <Notice tone="danger">Your payment didn&apos;t go through. You haven&apos;t been charged; you can try again below.</Notice>
          ) : fromDoctor && status === "awaiting_patient_approval" ? (
            <Notice tone="info">Your doctor requested these tests. Review the cost, then approve and pay to arrange the lab.</Notice>
          ) : null}
          {order.collection_method === "doctor" && (
            <Notice tone="success">Your doctor already took the sample during the visit, so there&apos;s no collection fee.</Notice>
          )}
          <CheckoutPanel
            orderId={order.id}
            fromDoctor={fromDoctor}
            doctorCollected={order.collection_method === "doctor"}
            defaultPhone={order.contact_phone ?? me?.phone ?? null}
            initial={{ address: order.collection_address, lat: order.collection_lat, lng: order.collection_lng }}
          />
        </>
      )}

      {(status === "declined_by_patient" || status === "cancelled") && (
        <Notice tone="info">
          {status === "declined_by_patient" ? "You declined these tests." : "This order was cancelled."}
          {order.refund_status === "due" ? " Your payment will be refunded." : ""}
        </Notice>
      )}
      {status === "exception" && (
        <Notice tone="warn">We&apos;re having trouble finding a lab for this order. Our team has been alerted and will contact you shortly.</Notice>
      )}

      {/* After payment: progress */}
      {stepAt >= 0 && (
        <Card>
          <ol className="space-y-3">
            {TIMELINE.map((step, i) => {
              const done = i < stepAt || (i === stepAt && hasResults);
              const current = i === stepAt && !hasResults;
              const time = when(reachedAt(step.statuses));
              return (
                <li key={step.key} className="flex items-center gap-3">
                  <span className={cx("grid h-7 w-7 flex-none place-items-center rounded-full text-ds-xs font-bold",
                    done ? "bg-success text-white" : current ? "bg-accent text-white" : "bg-track text-muted")}>
                    {done ? <Check size={14} aria-hidden /> : i + 1}
                  </span>
                  <span className={cx("flex-1 text-ds-sm", done || current ? "font-bold text-ink" : "text-muted")}>{step.label}</span>
                  {time && (done || current) && <span className="text-ds-xs text-muted">{time}</span>}
                </li>
              );
            })}
          </ol>
          {status !== "exception" && !hasResults && (
            <p className="mt-3 border-t border-line pt-3 text-ds-xs text-muted">
              Now: {INVESTIGATION_STATUS[status as keyof typeof INVESTIGATION_STATUS]?.label ?? status}
            </p>
          )}
        </Card>
      )}

      {stepAt >= 0 && (
        <Card padded={false} className="px-4 py-1">
          {lab?.name && <Detail icon={<FlaskConical size={16} aria-hidden />} label="Lab" value={lab.name} />}
          {order.collection_address && <Detail icon={<MapPin size={16} aria-hidden />} label="Address" value={order.collection_address} />}
          {order.collection_method === "doctor"
            ? <Detail icon={<CalendarClock size={16} aria-hidden />} label="Collection" value="Sample taken by your doctor" />
            : <Detail icon={<CalendarClock size={16} aria-hidden />} label="Collection"
                value={order.collection_scheduled_at ? when(order.collection_scheduled_at)!
                  : order.preferred_date ? `Requested ${new Date(`${order.preferred_date}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}, ${WINDOW_LABEL[order.preferred_window] ?? ""}`
                  : "To be confirmed"} />}
          {order.total_amount != null && <Detail icon={<Info size={16} aria-hidden />} label="Paid" value={formatNaira(Number(order.amount_paid ?? order.total_amount))} />}
        </Card>
      )}

      {/* Results */}
      {hasResults && (
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-navy">Results</h2>
          <Card padded={false} className="px-4 py-1">
            {results.filter(r => r.result_value).length === 0 ? (
              <p className="py-4 text-ds-sm text-muted">The lab attached your results as a report.</p>
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
          {hasReport && (
            <Button href={`/api/investigations/${order.id}/file?kind=report`} variant="secondary" target="_blank" rel="noopener noreferrer">
              <FileText size={18} aria-hidden /> Open the full lab report
            </Button>
          )}
          <p className="text-ds-xs text-muted">
            Lab results are not a diagnosis. A flag only means a value is outside the lab&apos;s usual range; a clinician can explain what it means for you.
          </p>

          {/* Doctor's review */}
          {fromDoctor && (status === "doctor_review_pending" ? (
            <Notice tone="info">Dr {doctorName ?? "your doctor"} has your results and will add their notes and next steps.</Notice>
          ) : order.reviewed_at && (
            <Card className="space-y-2">
              <p className="text-ds-sm font-bold text-navy">Notes from Dr {doctorName ?? "your doctor"}</p>
              {order.review_interpretation && <p className="text-ds-sm text-ink/90">{order.review_interpretation}</p>}
              {order.review_next_step && <p className="text-ds-sm"><b className="text-ink">Next step:</b> <span className="text-ink/90">{NEXT_STEP_LABEL[order.review_next_step]}</span></p>}
              {order.review_notes && <p className="text-ds-sm text-ink/90">{order.review_notes}</p>}
            </Card>
          ))}

          <div className="flex flex-wrap items-start gap-2.5">
            <ShareResults orderId={order.id} />
            {(!fromDoctor || order.review_next_step === "follow_up" || status === "follow_up_required") && (
              <Button href="/dashboard/book/general_consultation" size="sm"><Stethoscope size={16} aria-hidden /> Book a clinician to discuss</Button>
            )}
            {!rated && lab?.name && (
              <Button href={`/dashboard/rate/lab/${order.id}`} variant="ghost" size="sm">Rate {lab.name}</Button>
            )}
          </div>
        </section>
      )}

      {order.external_request && (
        <Card className="text-ds-sm">
          <p className="font-bold text-navy">Outside doctor&apos;s request</p>
          <p className="mt-1 text-muted">
            {[(order.external_request as any).doctor, (order.external_request as any).facility].filter(Boolean).join(" · ") || "Details attached"}
          </p>
          {(order.external_request as any).file_path && (
            <Link href={`/api/investigations/${order.id}/file?kind=request`} target="_blank" className="mt-1.5 inline-block font-bold text-accent hover:underline">Open the request</Link>
          )}
        </Card>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <span className="mt-0.5 text-muted">{icon}</span>
      <span className="w-20 flex-none text-ds-sm text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-ds-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
