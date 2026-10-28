import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight, Star, Stethoscope } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira, SERVICE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/shared";
import { Avatar, Button, Card, Pill, cx, focusRing, type PillTone } from "@/components/ds";
import CancelButton from "./CancelButton";
import ProviderDeclinedActions from "./ProviderDeclinedActions";
import VisitsTabs from "./VisitsTabs";

const ACTIVE = ["accepted", "en_route", "arrived", "in_progress"];
const PAST = ["completed", "cancelled", "expired"];

// Few, consistent tones: anything still progressing toward the visit is "info",
// with the exact stage in the label text.
const TONE: Record<string, PillTone> = {
  pending_payment: "warn",
  provider_declined: "bad",
  completed: "ok",
  cancelled: "idle",
  expired: "idle",
};

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
const tz = "Africa/Lagos";

function VisitCard({ b }: { b: any }) {
  const isActive = ACTIVE.includes(b.status);
  const isRated = (b.reviews?.length ?? 0) > 0;
  const service = sentence((SERVICE_LABELS as Record<string, string>)[b.service_type] ?? "");
  const when = new Date(b.scheduled_at ?? b.created_at);
  const href = b.status === "pending_payment" ? `/dashboard/book/payment/${b.id}`
    : isActive || ["pending", "paid"].includes(b.status) ? `/dashboard/book/tracking/${b.id}`
    : b.status === "completed" ? `/dashboard/journey/${b.id}`
    : null;
  const providerName = b.providers?.name ?? null;
  const bookAgain = b.providers?.referral_code
    ? `/dashboard/book/preferred-provider?code=${encodeURIComponent(b.providers.referral_code)}`
    : `/dashboard/book/${b.service_type}`;

  const head = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Pill tone={TONE[b.status] ?? "info"} icon={b.status === "completed" ? Check : CalendarDays}>
          {b.status === "completed" || !b.scheduled_at
            ? sentence((BOOKING_STATUS_LABELS as Record<string, string>)[b.status] ?? b.status)
            : when.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}
        </Pill>
        <span className="text-ds-sm text-muted">
          {b.scheduled_at && b.status !== "completed"
            ? when.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz })
            : when.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: tz })}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {providerName ? <Avatar name={providerName} src={b.providers?.photo_url} size="sm" /> : (
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-sky text-brand"><Stethoscope size={18} aria-hidden /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-ds-control font-extrabold text-navy">{providerName ?? service}</div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {[providerName ? service : "Provider not assigned yet", b.family_members && `for ${b.family_members.name}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {href && <ChevronRight size={20} className="text-muted" aria-hidden />}
      </div>
    </>
  );

  return (
    <div className="mb-3 rounded-ds-lg border border-line bg-surface p-4 shadow-ds-sm">
      {href ? (
        <Link href={href} className={cx("block rounded-ds-sm", focusRing)}>{head}</Link>
      ) : head}

      {b.follow_up_of_booking_id && (
        <p className="mt-2 text-ds-xs font-semibold text-accent">Recommended by your provider as a follow up visit</p>
      )}
      {b.status === "provider_declined" && (
        <p className="mt-2 text-ds-xs font-semibold text-danger">The provider you requested wasn&apos;t able to accept this booking.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ds-sm font-extrabold text-navy tabular-nums">{formatNaira(b.fee)}</span>
        <div className="flex flex-wrap items-center gap-2">
          {b.status === "pending_payment" && (
            <Button href={`/dashboard/book/payment/${b.id}`} className="min-h-10 px-4 text-ds-sm">Pay now <ArrowRight size={14} aria-hidden /></Button>
          )}
          {isActive && (
            <Button href={`/dashboard/book/tracking/${b.id}`} className="min-h-10 px-4 text-ds-sm">Track <ArrowRight size={14} aria-hidden /></Button>
          )}
          {b.status === "completed" && !isRated && (
            <Button href={`/dashboard/book/rate/${b.id}?providerId=${b.provider_id}`} variant="secondary" className="min-h-10 px-4 text-ds-sm">
              <Star size={14} aria-hidden /> Rate visit
            </Button>
          )}
          {b.status === "completed" && isRated && <span className="text-ds-xs font-semibold text-muted">Rated</span>}
          {b.status === "completed" && (
            <Button href={bookAgain} variant="secondary" className="min-h-10 px-4 text-ds-sm">Book again</Button>
          )}
          {b.status === "pending" && <CancelButton bookingId={b.id} />}
        </div>
      </div>
      {b.status === "provider_declined" && <ProviderDeclinedActions bookingId={b.id} />}
    </div>
  );
}

function Empty({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <Card className="px-5 py-6 text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[18px] bg-sky text-brand">
        <Stethoscope size={24} aria-hidden />
      </span>
      <b className="text-ink">{title}</b>
      <p className="mb-3.5 mt-1.5 text-ds-sm text-muted">{text}</p>
      <Button href="/dashboard">{cta}</Button>
    </Card>
  );
}

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, providers!bookings_provider_id_fkey(name, specialty, photo_url, referral_code), reviews(id), family_members(name, relationship)")
    .eq("patient_id", user!.id)
    .order("created_at", { ascending: false });

  const list = bookings ?? [];
  const upcoming = list.filter((b: any) => !PAST.includes(b.status));
  const past = list.filter((b: any) => PAST.includes(b.status));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Your visits</h1>
        <small className="text-[13px] font-semibold text-muted">Upcoming care and past records</small>
      </div>

      <VisitsTabs
        startOnPast={upcoming.length === 0 && past.length > 0}
        upcoming={
          <>
            {upcoming.map((b: any) => <VisitCard key={b.id} b={b} />)}
            <Empty title="Need another visit?" text="Book a verified provider in a few taps." cta="Find care" />
          </>
        }
        past={
          past.length > 0
            ? past.map((b: any) => <VisitCard key={b.id} b={b} />)
            : <Empty title="No past visits yet" text="Your completed visits and their records appear here." cta="Book your first visit" />
        }
      />
    </div>
  );
}
