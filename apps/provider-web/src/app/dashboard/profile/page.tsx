import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Clock, FileText, GraduationCap, Mail, Settings, ShieldCheck, Star } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { VERIFICATION_STATUS_LABELS, PROVIDER_AGREEMENT_TITLE, SERVICE_PRICES, formatNaira, type ServiceType } from "@streetdocmd/shared";
import { DOC_LABELS, hasCurrentAgreement } from "@/lib/onboarding";
import { weeklyHoursOf } from "@/lib/hours";
import { ComingSoonItem } from "@/components/ComingSoonBadge";
import AgreementAcceptCard from "@/components/AgreementAcceptCard";
import SignOutButton from "@/components/SignOutButton";
import SocialLinks from "@/components/SocialLinks";
import { Card, Pill, VerifiedBadge, cx, focusRing, iconButtonClass } from "@/components/ds";
import PhotoUpload from "@/components/PhotoUpload";
import EditProfileForm from "./EditProfileForm";
import AgreementLink from "./AgreementLink";

// The home visit each profession is booked for most
const MAIN_SERVICE: Record<string, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_assessment",
};
const REGULATOR: Record<string, string> = { doctor: "MDCN", nurse: "NMCN", physiotherapist: "MRTB" };

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*"): tolerate a database without migration 046's agreement columns
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!provider) return null;

  const mainService = MAIN_SERVICE[provider.profession];
  const [{ data: docs }, { data: feeRow }, { count: reviewCount }] = await Promise.all([
    supabase
      .from("provider_documents")
      .select("id, document_type, uploaded_at")
      .eq("provider_id", provider.id)
      .order("uploaded_at", { ascending: false }),
    mainService
      ? supabase.from("provider_services").select("price").eq("provider_id", provider.id).eq("service_type", mainService).eq("active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("provider_id", provider.id).eq("hidden", false),
  ]);

  const verified = provider.verification_status === "verified";
  const fee = feeRow?.price != null ? Number(feeRow.price) : mainService ? SERVICE_PRICES[mainService] : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="-mx-5 -mt-5 rounded-b-[32px] px-5 pb-[18px] pt-3.5 md:mx-0 md:mt-0 md:rounded-[32px]"
        style={{ background: "linear-gradient(170deg, var(--teal-soft) 0%, var(--bg) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="text-ds-xs font-bold text-navy">My profile</span>
          <Link href="#about" aria-label="Edit profile" className={iconButtonClass}><Settings size={18} aria-hidden /></Link>
        </div>
      </div>

      <div className="pt-[18px]">
        <PhotoUpload name={provider.name} src={provider.photo_url} endpoint="/api/profile/photo" tint="var(--teal-soft)" />
        <p className="mt-1.5 text-ds-xs text-muted">Patients see this photo when choosing a provider. Use a clear, recent photo of your face.</p>
        <h1 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{provider.name}</h1>
        <p className="mt-1 text-ds-sm text-muted">
          {[provider.specialty, provider.specialist_field].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {verified
            ? <VerifiedBadge>{REGULATOR[provider.profession] ?? provider.license_body ?? "Licence"} verified</VerifiedBadge>
            : <Pill tone={provider.verification_status === "rejected" ? "bad" : "idle"} icon={Clock}>
                {(VERIFICATION_STATUS_LABELS as Record<string, string>)[provider.verification_status]}
              </Pill>}
          {provider.license_number && <span className="text-ds-xs text-muted">{provider.license_body}: {provider.license_number}</span>}
        </div>
      </div>

      {!hasCurrentAgreement(provider.agreement_version) && (
        <div className="mt-4"><AgreementAcceptCard updated={!!provider.agreement_version} /></div>
      )}

      <Card padded={false} className="mt-[18px] px-5 py-1">
        <dl>
          {[
            ["Home visit fee", fee != null ? formatNaira(fee) : "Not set"],
            ["Service area", `Within ${provider.service_radius_km ?? 10} km of you`],
            ["Working days", Object.keys(weeklyHoursOf(provider)).length ? `${Object.keys(weeklyHoursOf(provider)).length} days a week` : "Not set"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
              <dt className="text-muted">{k}</dt>
              <dd className="font-bold text-ink tabular-nums">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2.5 text-ds-sm">
            <dt className="text-muted">Rating</dt>
            <dd>
              <Link href="/dashboard/reviews" className={cx("inline-flex items-center gap-1.5 rounded font-bold text-ink hover:text-accent", focusRing)}>
                <Star size={14} className="fill-amber-500 text-amber-500" aria-hidden />
                {provider.rating > 0 ? Number(provider.rating).toFixed(1) : "New"}
                <span className="text-ds-sm font-normal text-muted">{reviewCount ?? 0}</span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Account</h2>
        <Card padded={false} className="px-4 py-1">
          <Row href="#credentials" icon={<ShieldCheck size={18} aria-hidden />} title="Verification" text="Licence and documents" />
          <Row href="/dashboard/services" icon={<Settings size={18} aria-hidden />} title="Rates and services" text="Set what you charge per visit" />
          <Row href="/dashboard/reviews" icon={<Star size={18} aria-hidden />} title="Reviews" text="Read and reply to patient feedback" />
          <AgreementLink />
          <div aria-disabled="true" className="flex items-center gap-3 border-b border-line py-3.5 opacity-70 last:border-b-0">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-pending-bg text-pending"><Bell size={18} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-ds-sm text-pending">Notifications</b>
              <small className="text-ds-xs text-muted">Requests, orders and payouts</small>
            </span>
            <span className="rounded-md bg-pending-bg px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-pending">Soon</span>
          </div>
        </Card>
      </section>

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Your details</h2>
        <EditProfileForm
          profile={{
            providerId: provider.id,
            bio: provider.bio,
            languages: provider.languages,
            years_experience: provider.years_experience,
            service_radius_km: provider.service_radius_km,
            working_hours_start: provider.working_hours_start,
            working_hours_end: provider.working_hours_end,
            weekly_hours: weeklyHoursOf(provider),
            bank_name: provider.bank_name,
            bank_account_number: provider.bank_account_number,
            bank_account_name: provider.bank_account_name,
          }}
        />
      </section>

      <section id="credentials" className="mt-[26px] scroll-mt-24">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Credentials on file</h2>
        <Card>
          <p className="mb-3 text-ds-xs text-muted">
            Verified by the StreetdocMD team. To update a licence (for example on renewal), email{" "}
            <a href="mailto:contact@streetdocmd.com" className="font-bold text-accent hover:underline">contact@streetdocmd.com</a>.
          </p>
          {(docs ?? []).length === 0 ? (
            <p className="py-2 text-ds-sm text-muted">No documents on file.</p>
          ) : (
            <ul>
              {(docs ?? []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="flex min-w-0 items-center gap-2 text-ds-sm font-semibold text-ink">
                    <FileText size={16} className="flex-none text-muted" aria-hidden />
                    <span className="truncate">{DOC_LABELS[d.document_type] ?? d.document_type}</span>
                  </span>
                  <span className="flex-none text-ds-xs text-muted">
                    {new Date(d.uploaded_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {provider.agreement_accepted_at && (
            <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-ds-xs text-muted">
              <ShieldCheck size={15} className="flex-none text-success" aria-hidden />
              {PROVIDER_AGREEMENT_TITLE} v{provider.agreement_version} accepted{" "}
              {new Date(provider.agreement_accepted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </Card>
      </section>

      <section className="mt-[26px]">
        <h2 className="mb-3 text-[17px] font-bold text-navy">Support</h2>
        <Card padded={false} className="px-4 py-1">
          <a href="mailto:contact@streetdocmd.com" className={cx("flex items-center gap-3 border-b border-line py-3.5", focusRing)}>
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-teal-soft text-teal-deep"><Mail size={18} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-ds-sm text-ink">Email support</b>
              <small className="text-ds-xs text-muted">contact@streetdocmd.com</small>
            </span>
          </a>
          <div className="py-2.5"><SocialLinks /></div>
        </Card>
      </section>

      <div className="mt-[26px] grid gap-3 sm:grid-cols-2">
        <ComingSoonItem icon={ShieldCheck} title="Indemnity insurance"
          description="Upload your professional indemnity cover and get renewal reminders (agreement clause 6)." />
        <ComingSoonItem icon={GraduationCap} title="Training and CPD records"
          description="Keep your CPD points and training certificates in one place for licence renewal." />
      </div>

      <div className="mt-5 flex justify-center"><SignOutButton className="min-h-11 px-5 text-ds-sm" /></div>
    </div>
  );
}

function Row({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className={cx("flex items-center gap-3 border-b border-line py-3.5 last:border-b-0", focusRing)}>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-teal-soft text-teal-deep">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-ds-sm text-ink">{title}</b>
        <small className="text-ds-xs text-muted">{text}</small>
      </span>
      <ChevronRight size={20} className="text-muted" aria-hidden />
    </Link>
  );
}
