"use client";
import { CalendarPlus, Check, FileDown, FlaskConical, Pill as PillIcon, Star, TriangleAlert } from "lucide-react";
import { SERVICE_LABELS } from "@/lib/shared";
import { Avatar, Button, Card, Pill, TopBar } from "@/components/ds";
import RateForm from "@/app/dashboard/book/rate/[id]/RateForm";

export interface VisitExtras {
  bookingId: string | null;
  serviceType: string | null;
  providerId: string | null;
  providerSpecialty: string | null;
  providerPhoto: string | null;
  completed: boolean;
  vitals: { label: string; value: string; unit: string }[];
  referrals: { id: string; hospital: string; reason: string | null; status: string }[];
  myRating: number | null;
  prescriptionOrderId: string | null;
  followUpHref: string;
  patientId: string;
}

function generateICS(date: string, providerName: string): string {
  const d = new Date(date);
  const stamp = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${date.replace(/-/g, "")}\nDTEND;VALUE=DATE:${date.replace(/-/g, "")}\nSUMMARY:StreetdocMD Follow up with ${providerName}\nDESCRIPTION:Follow up appointment scheduled from your StreetdocMD visit.\nDTSTAMP:${stamp}\nEND:VEVENT\nEND:VCALENDAR`;
}

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[26px]">
      <h2 className="mb-3 text-[17px] font-bold text-navy">{title}</h2>
      {children}
    </section>
  );
}

function RxRow({ icon, tint, title, text }: { icon: React.ReactNode; tint: string; title: string; text?: string | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
      <span className={`grid h-10 w-10 flex-none place-items-center rounded-[13px] text-navy ${tint}`}>{icon}</span>
      <div className="min-w-0">
        <b className="block text-ds-sm text-ink">{title}</b>
        {text && <small className="text-ds-xs text-muted">{text}</small>}
      </div>
    </div>
  );
}

export default function VisitSummaryClient({ summary, extras }: { summary: any; extras: VisitExtras }) {
  const abnormal: any[] = summary.abnormal_vitals ?? [];
  const medications: any[] = summary.medications ?? [];
  const investigations: any[] = summary.investigations ?? [];
  const diagnoses: string[] = summary.plain_diagnosis?.split(",").map((d: string) => d.trim()).filter(Boolean) ?? [];
  const plan: string[] = (summary.recommendations ?? "").split(".").map((s: string) => s.trim()).filter(Boolean);
  const providerName: string = summary.provider_name ?? "Your provider";
  const serviceLabel = extras.serviceType ? sentence((SERVICE_LABELS as Record<string, string>)[extras.serviceType] ?? "") : null;
  const date = summary.visit_date
    ? new Date(summary.visit_date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })
    : null;

  const addToCalendar = () => {
    if (!summary.follow_up_date) return;
    const content = generateICS(summary.follow_up_date, providerName);
    const blob = new Blob([content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "streetdocmd-followup.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  const medsParam = encodeURIComponent(medications.map(m => m.name).filter(Boolean).join("|"));
  const testsParam = encodeURIComponent(investigations.map(t => t.test_name).filter(Boolean).join("|"));

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <TopBar title="Visit record" backHref="/dashboard/visits" className="-mx-5 -mt-2 md:mx-0 print:hidden" />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={providerName} src={extras.providerPhoto} size="sm" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-ds-control text-ink">{providerName}</b>
            <span className="text-ds-sm text-muted">{[date, serviceLabel].filter(Boolean).join(" · ")}</span>
          </div>
          {extras.completed && <Pill tone="ok">Completed</Pill>}
        </div>
      </Card>

      {extras.vitals.length > 0 && (
        <Section title="Vitals">
          <div className="grid grid-cols-2 gap-2.5">
            {extras.vitals.map(v => (
              <div key={v.label} className="rounded-[18px] border border-line bg-surface p-3.5">
                <small className="block text-ds-xs font-semibold text-muted">{v.label}</small>
                <b className="text-ds-xl text-navy tabular-nums">
                  {v.value}<span className="ml-1 text-ds-xs font-semibold text-muted">{v.unit}</span>
                </b>
              </div>
            ))}
          </div>
        </Section>
      )}

      {abnormal.length > 0 && (
        <div className="mt-3 rounded-ds-sm bg-warn-bg p-4">
          <p className="mb-2 flex items-center gap-2 text-ds-sm font-bold text-ink">
            <TriangleAlert size={18} className="text-warn" aria-hidden /> Important readings
          </p>
          <ul className="space-y-1.5">
            {abnormal.map((v: any, i: number) => (
              <li key={i} className="text-ds-sm text-ink">
                <b>{v.vital}: {v.value}.</b> {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Visit notes">
        <Card className="space-y-3 text-ds-sm leading-[1.6] text-ink/85">
          {summary.reason_for_visit && <p><b className="text-ink">Why we visited.</b> {summary.reason_for_visit}</p>}
          {diagnoses.length > 0 && <p><b className="text-ink">What was found.</b> {diagnoses.join(", ")}</p>}
          {summary.what_was_done && <p><b className="text-ink">What happened.</b> {summary.what_was_done}</p>}
          {!summary.reason_for_visit && diagnoses.length === 0 && !summary.what_was_done && <p className="text-muted">No notes were added.</p>}
        </Card>
      </Section>

      {plan.length > 0 && (
        <Section title="Treatment plan">
          <Card>
            <ol className="list-decimal space-y-1.5 pl-[18px] text-ds-sm leading-[1.6] text-ink/85">
              {plan.map((s, i) => <li key={i}>{s}.</li>)}
            </ol>
          </Card>
        </Section>
      )}

      {medications.length > 0 && (
        <Section title="Prescriptions">
          <Card padded={false} className="px-4 py-1">
            {medications.map((m: any, i: number) => (
              <RxRow key={i} tint="bg-sky" icon={<PillIcon size={18} aria-hidden />} title={m.name}
                text={[m.how_to_take, m.duration, m.what_it_treats && `for ${m.what_it_treats}`].filter(Boolean).join(" · ")} />
            ))}
          </Card>
          {extras.prescriptionOrderId ? (
            <Button href={`/dashboard/medications/${extras.prescriptionOrderId}`} block className="mt-3 print:hidden">
              Track your medicine order
            </Button>
          ) : (
            <Button href={`/dashboard/book/medication?add=${medsParam}`} block className="mt-3 print:hidden">
              Send to a pharmacy
            </Button>
          )}
        </Section>
      )}

      {investigations.length > 0 && (
        <Section title="Lab orders">
          <Card padded={false} className="px-4 py-1">
            {investigations.map((t: any, i: number) => (
              <RxRow key={i} tint="bg-tint-mint" icon={<FlaskConical size={18} aria-hidden />} title={t.test_name} text={t.expected_timeline} />
            ))}
          </Card>
          <Button href={`/dashboard/book/lab-investigations/custom?add=${testsParam}`} variant="secondary" block className="mt-3 print:hidden">
            Book home sample collection
          </Button>
        </Section>
      )}

      {extras.referrals.length > 0 && (
        <Section title="Referral">
          <div className="space-y-2.5">
            {extras.referrals.map(r => (
              <div key={r.id} className="rounded-ds-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <b className="text-ds-control text-ink">{r.hospital}</b>
                  <Pill tone={r.status === "pending" ? "idle" : "info"}>{sentence(r.status.replace(/_/g, " "))}</Pill>
                </div>
                {r.reason && <p className="mt-1.5 text-ds-sm text-muted">{r.reason}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {summary.follow_up_date && (
        <Section title="Your next appointment">
          <Card className="flex items-center justify-between gap-3">
            <b className="text-ds-md text-navy">
              {new Date(summary.follow_up_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
            </b>
            <Button variant="secondary" onClick={addToCalendar} className="min-h-11 px-4 print:hidden">
              <CalendarPlus size={16} aria-hidden /> Add to calendar
            </Button>
          </Card>
        </Section>
      )}

      {extras.completed && extras.bookingId && extras.providerId && (
        <Section title="Rate your visit">
          {extras.myRating ? (
            <Card>
              <div className="flex gap-1.5" aria-label={`You rated this visit ${extras.myRating} out of 5`}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={28} className={n <= extras.myRating! ? "fill-amber-500 text-amber-500" : "fill-line text-amber-500"} aria-hidden />
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-ds-sm text-muted">
                <Check size={14} aria-hidden /> Thank you. Your rating helps other patients choose.
              </p>
            </Card>
          ) : (
            <RateForm bookingId={extras.bookingId} providerId={extras.providerId} patientId={extras.patientId} inline />
          )}
        </Section>
      )}

      <div className="mt-6 space-y-2.5 print:hidden">
        <Button href={extras.followUpHref} block>Book a follow up</Button>
        <Button variant="secondary" block onClick={() => window.print()}>
          <FileDown size={18} aria-hidden /> Download as PDF
        </Button>
      </div>
    </div>
  );
}
