import Image from "next/image";
import Link from "next/link";
import {
  Bandage, CalendarClock, ChevronRight, FileText, FlaskConical, HeartHandshake, House, KeyRound, PenLine, Pill,
  Search, ShieldCheck, Star, Stethoscope, Activity, Syringe, Truck, Video, type LucideIcon,
} from "lucide-react";
import { SERVICE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/shared";
import type { ServiceType } from "@/lib/shared";
import { Avatar, Card, cx, focusRing } from "@/components/ds";

// Presentation for the patient home (/dashboard). All data is loaded in page.tsx.

export interface HomeBooking {
  id: string;
  service_type: string;
  status: string;
  scheduled_at: string | null;
  providerName: string | null;
}

export interface HomeViewProps {
  firstName: string;
  justOnboarded: boolean;
  /** Which of the details a visiting clinician relies on are filled in */
  profileChecks: { dob: boolean; gender: boolean; emergencyContact: boolean } | null;
  isFirstVisit: boolean;
  /** In-progress visit, or the soonest confirmed future visit */
  careBooking: HomeBooking | null;
  careIsActive: boolean;
  /** Medicine running out soonest, if within the refill window */
  refill: { name: string; daysLeft: number } | null;
  /** An unpaid booking or medicine order from the last two days */
  resume: { href: string; kind: "visit" | "order"; title: string; sub: string | null } | null;
  /** Recent providers from completed visits */
  bookAgain: { id: string; name: string; photo: string | null; role: string | null; rating: number; href: string }[];
  now: Date;
}

interface Tile {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
  tint: string;
}

// Same services and routes as before, in the design's order and words.
// physiotherapy_session is never a front door option (only a follow up), so it isn't here.
const TILES: Tile[] = [
  { href: "/dashboard/book/general_consultation", title: "General consultation", text: "A doctor visits to assess and advise", icon: Stethoscope, tint: "bg-tint-blue" },
  { href: "/dashboard/book/lab-investigations", title: "Wellness and labs", text: "Tests with sample collected at home", icon: FlaskConical, tint: "bg-tint-mint" },
  { href: "/dashboard/book/wound_care", title: "Wound care", text: "Dressings and monitoring by a nurse", icon: Bandage, tint: "bg-tint-rose" },
  { href: "/dashboard/book/elderly_review", title: "Elderly review", text: "Regular checks for ageing parents", icon: HeartHandshake, tint: "bg-tint-amber" },
  { href: "/dashboard/book/physiotherapy_assessment", title: "Physiotherapy", text: "Assessment and follow up sessions", icon: Activity, tint: "bg-tint-green" },
  { href: "/dashboard/book/medication", title: "Buy medication", text: "Delivered from a partner pharmacy", icon: Pill, tint: "bg-tint-yellow" },
  { href: "/dashboard/book/nursing_care", title: "Nursing care", text: "Procedures and care by a nurse at home", icon: Syringe, tint: "bg-tint-violet" },
  { href: "/dashboard/book/custom", title: "Something else", text: "Describe the care you need", icon: PenLine, tint: "bg-tint-sky" },
];

const SOON = [
  { icon: Video, title: "Video consultation", text: "Talk to a doctor from your phone" },
  { icon: FileText, title: "Care plans", text: "Ongoing programmes for long term conditions" },
];

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function visitTime(iso: string, now: Date) {
  const d = new Date(iso);
  const tz = "Africa/Lagos";
  const dayKey = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const time = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toLowerCase();
  if (dayKey(d) === dayKey(now)) return `Today, ${time}`;
  if (dayKey(d) === dayKey(tomorrow)) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}, ${time}`;
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[17px] font-bold text-navy">{title}</h2>
      {action}
    </div>
  );
}

function NextVisitCard({ booking, active, now }: { booking: HomeBooking; active: boolean; now: Date }) {
  const service = sentence((SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? "");
  const href = active ? `/dashboard/book/tracking/${booking.id}` : "/dashboard/bookings";
  const msLeft = booking.scheduled_at ? new Date(booking.scheduled_at).getTime() - now.getTime() : 0;
  const hours = Math.max(0, Math.floor(msLeft / 3_600_000));
  const minutes = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));
  const Icon = active ? Truck : CalendarClock;

  return (
    <div
      className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_18px_36px_rgba(13,43,94,0.28)]"
      style={{ background: "linear-gradient(140deg, var(--navy) 0%, var(--blue) 100%)" }}
    >
      <span aria-hidden className="absolute -right-[60px] -top-[60px] h-[180px] w-[180px] rounded-full bg-white/[0.09]" />
      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/[0.18] px-2.5 py-[5px] text-ds-xs font-bold leading-none text-white">
          {active && <Icon size={13} strokeWidth={2.6} aria-hidden />}
          {active ? "Your visit" : "Next visit"}
        </span>
        <span className="text-[13px] font-semibold text-brand-mist">
          {active
            ? (BOOKING_STATUS_LABELS as Record<string, string>)[booking.status]
            : booking.scheduled_at && visitTime(booking.scheduled_at, now)}
        </span>
      </div>
      <h3 className="relative mt-3 text-[19px] font-bold leading-tight text-white">{booking.providerName ?? service}</h3>
      <p className="relative mt-1 text-[13px] text-brand-mist">{booking.providerName ? `${service} · Home visit` : "Home visit"}</p>

      {!active && booking.scheduled_at && msLeft > 0 && hours < 100 && (
        <div className="relative mt-3.5 flex gap-1.5" aria-label={`${hours} hours and ${minutes} minutes to go`}>
          {[[hours, "Hours"], [minutes, "Minutes"]].map(([n, l]) => (
            <div key={l} className="min-w-[58px] rounded-xl bg-white/[0.14] px-2.5 py-2 text-center">
              <b className="block text-ds-lg tabular-nums">{n}</b>
              <small className="text-[10px] uppercase tracking-[0.06em] text-brand-mist">{l}</small>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-4 flex gap-2">
        <Link
          href={href}
          className={cx("flex min-h-11 flex-1 items-center justify-center rounded-pill bg-white text-ds-sm font-semibold text-navy", focusRing)}
        >
          {active ? "Track visit" : "View details"}
        </Link>
        {/* TODO(design): "Remind me" needs a visit reminder feature (no backend for it yet). */}
      </div>
    </div>
  );
}

function ProfileProgress({ checks }: { checks: NonNullable<HomeViewProps["profileChecks"]> }) {
  const done = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const pct = Math.round((done / total) * 100);
  const circumference = 132; // 2 * pi * 21
  return (
    <div className="flex items-center gap-3.5 rounded-ds-lg border border-line bg-surface p-4">
      <div className="relative h-[52px] w-[52px] flex-none" role="img" aria-label={`Profile ${pct}% complete`}>
        <svg viewBox="0 0 52 52" className="h-[52px] w-[52px] -rotate-90" aria-hidden>
          <circle cx="26" cy="26" r="21" fill="none" stroke="var(--line)" strokeWidth="5" />
          <circle cx="26" cy="26" r="21" fill="none" stroke="var(--teal)" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - done / total)} />
        </svg>
        <b className="absolute inset-0 grid place-items-center text-[13px] text-navy">{pct}%</b>
      </div>
      <div className="min-w-0 flex-1">
        <b className="text-ds-sm text-ink">Finish your profile</b>
        <p className="text-ds-sm text-muted">Add your date of birth, gender and an emergency contact so providers arrive ready.</p>
      </div>
      <Link href="/onboarding/medical" className={cx("text-[13px] font-bold text-accent rounded-sm", focusRing)}>
        Finish
      </Link>
    </div>
  );
}

export default function HomeView({
  firstName, justOnboarded, profileChecks, isFirstVisit, careBooking, careIsActive, refill, resume, bookAgain, now,
}: HomeViewProps) {
  const profileIncomplete = !!profileChecks && Object.values(profileChecks).some(v => !v);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero: greeting on the left, the doctor (with the brand blob behind)
          on the right, standing on the search bar. Both PNGs share one canvas,
          so stacking them keeps the blob exactly behind the doctor. */}
      <div className="relative -mx-5 -mt-5 bg-gradient-to-b from-sky/70 to-transparent px-5 pt-5 md:-mt-8 md:mx-0 md:rounded-t-ds-lg md:px-6">
        <div className="relative flex min-h-[196px] items-center sm:min-h-[240px]">
          <div className="relative z-10 w-[70%] pb-4 sm:w-[60%]">
            <p className="text-ds-md font-medium text-muted">{greeting(now)}</p>
            <h1 className="mt-1 text-[24px] font-extrabold leading-[1.18] tracking-[-0.02em] text-navy sm:text-[32px]">
              {justOnboarded ? `Welcome to StreetdocMD, ${firstName}` : `${firstName}, how are you feeling?`}
            </h1>
          </div>
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-[-18px] w-[54%] max-w-[300px] select-none sm:right-0">
            <Image src="/splash-transparent.png" alt="" width={535} height={466} priority
              className="absolute inset-0 h-auto w-full dark:opacity-30" />
            <Image src="/founder-doctor-portrait-transparent.png" alt="" width={535} height={466} priority
              className="relative h-auto w-full" />
          </div>
        </div>
      </div>

      <Link href="/dashboard/search"
        className={cx("relative z-10 mb-4 flex h-[56px] items-center gap-2.5 rounded-pill border border-line bg-surface px-5 text-muted shadow-ds", focusRing)}>
        <Search size={20} className="flex-none text-navy" aria-hidden />
        <span className="text-ds-control">Search doctors, medicines, tests</span>
      </Link>

      {careBooking && <NextVisitCard booking={careBooking} active={careIsActive} now={now} />}

      {resume && (
        <Link href={resume.href}
          className={cx("mt-[26px] flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-ds-sm", focusRing)}>
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-tint-mint text-navy">
            {resume.kind === "order" ? <Pill size={20} aria-hidden /> : <Stethoscope size={20} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-ds-sm text-ink">
              {resume.kind === "visit" ? sentence((SERVICE_LABELS as Record<string, string>)[resume.title] ?? "Your booking") : resume.title}
            </b>
            <span className="block truncate text-ds-sm text-muted">{[resume.sub, "Payment pending · Step 2 of 3"].filter(Boolean).join(" · ")}</span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded bg-line" aria-hidden><span className="block h-full w-2/3 bg-teal" /></span>
          </span>
          <ChevronRight size={20} className="text-muted" aria-hidden />
        </Link>
      )}

      {isFirstVisit && !careBooking && (
        <Card className="mt-6">
          <h2 className="mb-4 text-ds-sm font-bold text-navy">How StreetdocMD works</h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Stethoscope, title: "Choose a service", text: "Pick the care you need below and tell us where you are." },
              { icon: ShieldCheck, title: "Pay securely", text: "Pay securely online through Paystack to confirm your booking." },
              { icon: House, title: "Care comes to you", text: "A verified clinician accepts and you can track them to your door." },
            ].map(({ icon: StepIcon, title, text }, i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky text-brand">
                  <StepIcon size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-ds-sm font-bold text-ink">{i + 1}. {title}</p>
                  <p className="mt-0.5 text-ds-xs leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <section className="mt-[26px]">
        <SectionHead title="What do you need?" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TILES.map(({ href, title, text, icon: Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex min-h-[128px] flex-col gap-[22px] rounded-ds-lg p-4 text-left text-ink transition-transform active:scale-[0.98]",
                tint,
                focusRing,
              )}
            >
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/70 text-navy">
                <Icon size={22} aria-hidden />
              </span>
              <span>
                <b className="block text-ds-control text-navy">{title}</b>
                <small className="mt-[3px] block text-ds-xs leading-[1.35] text-ink/75">{text}</small>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-ds-xs text-muted">Not for emergencies. In an emergency, call 112 or go to the nearest emergency room.</p>
      </section>

      <Link
        href="/dashboard/book/preferred-provider"
        className={cx("mt-[26px] flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 shadow-ds-sm", focusRing)}
      >
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-sky text-brand">
          <KeyRound size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-ds-sm text-ink">Have a preferred provider?</b>
          <span className="text-ds-sm text-muted">Enter their code to book directly with them</span>
        </span>
        <ChevronRight size={20} className="text-muted" aria-hidden />
      </Link>

      {bookAgain.length > 0 && (
        <section className="mt-[26px]">
          <SectionHead title="Book again" action={<Link href="/dashboard/bookings" className="text-[13px] font-bold text-accent">History</Link>} />
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
            {bookAgain.map(p => (
              <div key={p.id} className="w-[210px] flex-none rounded-ds-lg border border-line bg-surface p-4 shadow-ds-sm">
                <Avatar name={p.name} src={p.photo} size="sm" />
                <b className="mt-3 block truncate text-ds-control text-ink">{p.name}</b>
                {p.role && <span className="block truncate text-ds-xs text-muted">{p.role}</span>}
                {p.rating > 0 && (
                  <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-extrabold text-ink">
                    <Star size={14} className="fill-amber-500 text-amber-500" aria-hidden /> {p.rating.toFixed(1)}
                  </span>
                )}
                <Link href={p.href}
                  className={cx("mt-3 flex min-h-11 items-center justify-center rounded-pill bg-sky text-ds-sm font-semibold text-navy", focusRing)}>
                  Book again
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
      {refill && (
        <section className="mt-[26px]">
          <div className="flex items-center gap-3 rounded-[20px] border border-warn/20 bg-warn-bg p-3.5">
            <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-white/70 text-warn">
              <Pill size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-ds-sm text-ink">
                {refill.daysLeft > 0
                  ? `${refill.name} runs out in ${refill.daysLeft} day${refill.daysLeft === 1 ? "" : "s"}`
                  : `${refill.name} has run out`}
              </b>
              <small className="text-ds-xs text-ink/70">Order a refill from a partner pharmacy.</small>
            </div>
            <Link href={`/dashboard/book/medication?add=${encodeURIComponent(refill.name)}`}
              className={cx("grid min-h-10 place-items-center rounded-xl bg-white px-3 text-ds-sm font-bold text-navy", focusRing)}>
              Refill
            </Link>
          </div>
        </section>
      )}

      {profileIncomplete && profileChecks && (
        <section className="mt-[26px]">
          <ProfileProgress checks={profileChecks} />
        </section>
      )}

      <section className="mt-[26px]">
        <SectionHead title="Coming soon" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SOON.map(({ icon: Icon, title, text }) => (
            <div key={title} aria-disabled="true"
              className="flex select-none items-center gap-3 rounded-[18px] border border-dashed border-muted/40 bg-surface px-3.5 py-3 opacity-70">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-pending-bg text-pending">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-ds-sm text-pending">{title}</b>
                <small className="block text-ds-xs text-muted">{text}</small>
              </span>
              <span className="rounded-md bg-pending-bg px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-pending">Soon</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
