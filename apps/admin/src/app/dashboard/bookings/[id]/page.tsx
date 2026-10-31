import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { formatNaira, SERVICE_LABELS } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import LiveRefresh from "@/components/ui/LiveRefresh";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : null;

const DISPATCH_RESPONSE: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  expired: { label: "No response", tone: "warning" },
};

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="mb-3 border-b border-gray-100 pb-2 text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-800">{empty ? <span className="text-gray-400">—</span> : children}</dd>
    </div>
  );
}

function ProviderLink({ p }: { p?: { id: string; name: string; specialty: string | null; phone: string | null } }) {
  if (!p) return null;
  return (
    <>
      <Link href={`/dashboard/providers/${p.id}`} className="font-semibold text-blue-brand hover:underline">{p.name}</Link>
      <span className="block text-xs text-gray-500">{[p.specialty, p.phone].filter(Boolean).join(" · ")}</span>
    </>
  );
}

// Everything about one booking: who, where, when, money, dispatch history and
// the clinical records it produced.
export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: b } = await admin.from("bookings").select("*").eq("id", params.id).maybeSingle();
  if (!b) notFound();

  const [patientRes, familyRes, paymentsRes, dispatchRes, notesRes, nursingRes, physioRes, rxRes, invRes, reviewRes, pkgRes] = await Promise.all([
    admin.from("users").select("id, name, phone, email, dob, gender").eq("id", b.patient_id).maybeSingle(),
    b.family_member_id
      ? admin.from("family_members").select("*").eq("id", b.family_member_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("payments").select("id, amount, method, paystack_reference, status, created_at").eq("booking_id", b.id).order("created_at"),
    admin.from("dispatch_queue").select("id, provider_id, sent_at, expires_at, response, responded_at").eq("booking_id", b.id).order("sent_at"),
    admin.from("clinical_notes").select("id, status, submitted_at, created_at").eq("booking_id", b.id),
    admin.from("nursing_encounters").select("id, status, submitted_at").eq("booking_id", b.id),
    admin.from("physiotherapy_encounters").select("id, status, submitted_at").eq("booking_id", b.id),
    admin.from("prescriptions").select("id, drugs, created_at").eq("booking_id", b.id),
    admin.from("investigation_orders").select("id, status, tests, amount_paid, ordered_at").eq("booking_id", b.id),
    admin.from("reviews").select("rating, comment, reply, hidden, created_at").eq("booking_id", b.id).maybeSingle(),
    b.wellness_package_id
      ? admin.from("wellness_packages").select("name").eq("id", b.wellness_package_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const patient = patientRes.data as any;
  const family = familyRes.data as any;
  const payments = (paymentsRes.data ?? []) as any[];
  const dispatch = (dispatchRes.data ?? []) as any[];
  const notes = (notesRes.data ?? []) as any[];
  const encounters = [
    ...((nursingRes.data ?? []) as any[]).map(e => ({ ...e, kind: "Nursing encounter" })),
    ...((physioRes.data ?? []) as any[]).map(e => ({ ...e, kind: "Physiotherapy encounter" })),
  ];
  const prescriptions = (rxRes.data ?? []) as any[];
  const investigations = (invRes.data ?? []) as any[];
  const review = reviewRes.data as any;
  const pkg = pkgRes.data as any;

  const providerIds = Array.from(new Set(
    [b.provider_id, b.targeted_provider_id, b.preferred_provider_id, ...dispatch.map(d => d.provider_id)].filter(Boolean),
  )) as string[];
  const { data: providerRows } = providerIds.length
    ? await admin.from("providers").select("id, name, specialty, phone").in("id", providerIds)
    : { data: [] as any[] };
  const providers = new Map((providerRows ?? []).map((p: any) => [p.id, p]));

  const fee = Number(b.fee ?? 0);
  const serviceCharge = Number(b.service_charge ?? 0);
  const service = (SERVICE_LABELS as Record<string, string>)[b.service_type] ?? String(b.service_type ?? "").replace(/_/g, " ");
  const timeline = [
    ["Requested", b.created_at],
    ["Scheduled for", b.scheduled_at],
    ["Accepted", b.accepted_at],
    ["Arrived", b.arrived_at],
    ["Completed", b.completed_at],
    ["Cancelled", b.cancelled_at],
  ].filter(([, t]) => t) as [string, string][];
  const requested = b.targeted_provider_id ?? b.preferred_provider_id;

  return (
    <div className="max-w-5xl">
      <LiveRefresh sources={[{ table: "bookings", filter: `id=eq.${b.id}` }, { table: "dispatch_queue", filter: `booking_id=eq.${b.id}` }]} intervalMs={20_000} />
      <PageHeader
        backHref="/dashboard/bookings"
        backLabel="Bookings"
        title={`${service}${pkg?.name ? ` · ${pkg.name}` : ""}`}
        description={<span className="font-mono text-xs">{b.id}</span>}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} size="md" />
            {b.payment_status && <StatusBadge status={b.payment_status} size="md" tone={b.payment_status === "successful" || b.payment_status === "paid" ? "success" : undefined} />}
            {b.refund_status && <StatusBadge status={b.refund_status} size="md" label={`Refund ${b.refund_status}`} tone={b.refund_status === "refunded" ? "success" : "warning"} />}
            {b.is_follow_up && <StatusBadge status="follow_up" size="md" label="Follow up" tone="info" />}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Patient">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Account holder">{patient?.name}</Field>
            <Field label="Phone">{patient?.phone && <a href={`tel:${patient.phone}`} className="text-blue-brand hover:underline">{patient.phone}</a>}</Field>
            <Field label="Email">{patient?.email}</Field>
            <Field label="Visit is for">{family ? `${family.name} (${family.relationship ?? "family member"})` : "The account holder"}</Field>
            {family && <Field label="Their phone">{family.phone && <a href={`tel:${family.phone}`} className="text-blue-brand hover:underline">{family.phone}</a>}</Field>}
          </dl>
        </Section>

        <Section title="Provider">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Assigned">{b.provider_id ? <ProviderLink p={providers.get(b.provider_id)} /> : "Not assigned"}</Field>
            <Field label="Patient asked for">{requested ? <ProviderLink p={providers.get(requested)} /> : "Nearest available"}</Field>
            <Field label="Profession">{b.profession ? String(b.profession).replace(/_/g, " ") : null}</Field>
            <Field label="Dispatch attempts">{b.dispatch_attempts ?? 0}</Field>
          </dl>
        </Section>

        <Section title="Visit">
          <dl className="grid gap-3">
            <Field label="Address">
              {b.patient_address}
              {b.patient_lat != null && b.patient_lng != null && (
                <a href={`https://www.google.com/maps?q=${b.patient_lat},${b.patient_lng}`} target="_blank" rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-xs font-semibold text-blue-brand hover:underline">
                  Open in Google Maps <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </Field>
            <Field label="Patient's notes">{b.notes}</Field>
            {b.duration_minutes && <Field label="Planned length">{`${b.duration_minutes} min`}</Field>}
            {b.care_episode_id && (
              <Field label="Care journey">
                <Link href={`/dashboard/journeys/${b.care_episode_id}`} className="font-semibold text-blue-brand hover:underline">Open the care journey</Link>
              </Field>
            )}
            {b.follow_up_of_booking_id && (
              <Field label="Follow up of">
                <Link href={`/dashboard/bookings/${b.follow_up_of_booking_id}`} className="font-mono text-xs text-blue-brand hover:underline">{b.follow_up_of_booking_id}</Link>
              </Field>
            )}
          </dl>
        </Section>

        <Section title="Timeline">
          <ol className="space-y-2.5">
            {timeline.map(([label, t]) => (
              <li key={label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-right font-medium text-gray-800">{fmt(t)}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Money">
          <dl className="space-y-2 text-sm">
            {[
              ["Visit fee", formatNaira(fee)],
              // Only older bookings have one
              ...(serviceCharge > 0 ? [["Service charge", formatNaira(serviceCharge)]] : []),
              ["Patient total", formatNaira(fee + serviceCharge)],
              ["StreetdocMD commission", b.commission != null ? formatNaira(Number(b.commission)) : null],
              ["Provider payout", b.net_payout != null ? formatNaira(Number(b.net_payout)) : null],
            ].map(([k, v]) => (
              <div key={k} className={`flex justify-between gap-3 ${k === "Patient total" ? "border-t border-gray-100 pt-2 font-semibold" : ""}`}>
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-gray-900 tabular-nums">{v ?? <span className="text-gray-400">—</span>}</dd>
              </div>
            ))}
          </dl>
          {payments.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-medium uppercase text-gray-400">Payment attempts</p>
              <ul className="space-y-2">
                {payments.map(p => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-800">{formatNaira(Number(p.amount ?? 0))}</span>
                      <span className="block break-all font-mono text-xs text-gray-500">{p.paystack_reference ?? p.method ?? "—"} · {fmt(p.created_at)}</span>
                    </span>
                    <StatusBadge status={p.status ?? "unknown"} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Dispatch history">
          {dispatch.length === 0 ? (
            <p className="text-sm text-gray-400">No provider has been offered this visit.</p>
          ) : (
            <ol className="space-y-3">
              {dispatch.map(d => {
                const r = d.response ? DISPATCH_RESPONSE[d.response] ?? { label: d.response, tone: "neutral" as const } : null;
                const p = providers.get(d.provider_id) as any;
                return (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {p ? <Link href={`/dashboard/providers/${p.id}`} className="font-semibold text-blue-brand hover:underline">{p.name}</Link> : <span className="text-gray-500">Removed provider</span>}
                      <span className="block text-xs text-gray-500">
                        Offered {fmt(d.sent_at)}{d.responded_at ? ` · answered ${fmt(d.responded_at)}` : ""}
                      </span>
                    </span>
                    {r ? <StatusBadge status={d.response} label={r.label} tone={r.tone} /> : <StatusBadge status="waiting" label="Waiting" tone="info" />}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <Section title="Clinical records" className="lg:col-span-2">
          {notes.length + encounters.length + prescriptions.length + investigations.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing recorded for this visit yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notes.map(n => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/dashboard/clinical-notes/${n.id}`} className="font-semibold text-blue-brand hover:underline">Clinical note</Link>
                  <span className="text-xs text-gray-500">{n.status === "submitted" ? `Submitted ${fmt(n.submitted_at)}` : "Draft"}</span>
                </li>
              ))}
              {encounters.map(e => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-semibold text-gray-800">{e.kind}</span>
                  <span className="text-xs text-gray-500">{e.status === "submitted" ? `Submitted ${fmt(e.submitted_at)}` : e.status ?? "Draft"}</span>
                </li>
              ))}
              {prescriptions.map(rx => {
                const drugs: any[] = Array.isArray(rx.drugs) ? rx.drugs : [];
                return (
                  <li key={rx.id} className="py-2.5 text-sm">
                    <span className="font-semibold text-gray-800">Prescription</span>
                    <span className="ml-2 text-xs text-gray-500">{fmt(rx.created_at)}</span>
                    <span className="block text-gray-600">{drugs.map(d => [d.drug_name ?? d.name, d.dosage ?? d.strength].filter(Boolean).join(" ")).join(", ") || "No drugs listed"}</span>
                  </li>
                );
              })}
              {investigations.map(o => {
                const tests: any[] = Array.isArray(o.tests) ? o.tests : [];
                return (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-800">Test order</span>
                      <span className="block text-gray-600">{tests.map(t => t.test_name ?? t.name).filter(Boolean).join(", ") || "No tests listed"}</span>
                    </span>
                    <StatusBadge status={o.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {review && (
          <Section title="Patient review" className="lg:col-span-2">
            <p className="text-sm font-semibold text-gray-800">
              {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(Math.max(0, 5 - review.rating))}</span>
              {review.hidden && <span className="ml-2 text-xs font-medium text-red-600">Hidden by an admin</span>}
            </p>
            {review.comment && <p className="mt-1 text-sm text-gray-700">{review.comment}</p>}
            {review.reply && <p className="mt-2 border-l-2 border-gray-200 pl-3 text-sm text-gray-600">Provider reply: {review.reply}</p>}
          </Section>
        )}
      </div>
    </div>
  );
}
