import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, CreditCard, FileText, Lock, Mail, MapPin, Pencil, Users } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { SUPPORT_EMAIL } from "@/lib/brand";
import LegalDocumentLink from "@/components/LegalDocumentLink";
import SocialLinks from "@/components/SocialLinks";
import { Card, cx, focusRing, iconButtonClass } from "@/components/ds";
import PhotoUpload from "@/components/PhotoUpload";
import { formatLegalDate, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal-acceptance";
import SignOutButton from "./SignOutButton";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("users").select("*").eq("id", user!.id).single();
  const { count: familyCount } = await supabase.from("family_members").select("id", { count: "exact", head: true });

  if (!p) redirect("/register?complete=1");

  const dobLabel = p.dob
    ? new Date(`${p.dob}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const genderLabel = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : null;
  const terms = acceptanceStatus("Accepted", p.terms_version, p.terms_accepted_at, TERMS_VERSION);
  const privacy = acceptanceStatus("Acknowledged", p.privacy_policy_version, p.privacy_acknowledged_at, PRIVACY_VERSION);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="-mx-5 -mt-5 rounded-b-[32px] px-5 pb-[18px] pt-3.5 md:mx-0 md:mt-0 md:rounded-[32px]"
        style={{ background: "linear-gradient(170deg, var(--sky) 0%, var(--bg) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="text-ds-xs font-bold text-navy">My profile</span>
          <Link href="/dashboard/profile/edit" aria-label="Edit profile" className={iconButtonClass}>
            <Pencil size={18} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="pt-[18px]">
        <PhotoUpload name={p.name ?? "Patient"} src={p.photo_url} endpoint="/api/profile/photo" />
        <h1 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{p.name}</h1>
        <p className="mt-1 text-ds-sm text-muted">{[p.address, p.phone].filter(Boolean).join(" · ")}</p>
        <p className="text-ds-sm text-muted">{p.email ?? user!.email}</p>
      </div>

      <Card className="mt-[18px]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-ds-control font-bold text-navy">Medical profile</h2>
          <Link href="/dashboard/profile/edit" className={cx("text-[13px] font-bold text-accent rounded-sm", focusRing)}>Edit</Link>
        </div>
        <dl>
          <Kv label="Date of birth">{dobLabel ?? <Muted>Not set</Muted>}</Kv>
          <Kv label="Gender">{genderLabel ?? <Muted>Not set</Muted>}</Kv>
          <Kv label="Blood group">{p.blood_group ?? <Muted>Not set</Muted>}</Kv>
          <Kv label="Allergies"><Tags items={p.allergies} /></Kv>
          <Kv label="Conditions"><Tags items={p.known_conditions} /></Kv>
          <Kv label="Medications"><Tags items={p.current_medications} /></Kv>
          <Kv label="Emergency contact">
            {p.emergency_contact_name
              ? [p.emergency_contact_name, p.emergency_contact_relationship?.toLowerCase()].filter(Boolean).join(", ")
              : <Link href="/dashboard/profile/edit" className="font-bold text-accent">Add contact</Link>}
          </Kv>
        </dl>
      </Card>

      <Section title="Account">
        <ListLink href="/dashboard/profile/family" icon={<Users size={18} aria-hidden />} title="Family members"
          text={familyCount ? `${familyCount} ${familyCount === 1 ? "person" : "people"} you can book for` : "Book for a parent, child or someone else"} />
        <LegalDocumentLink slug="patient-terms" className={rowClass}>
          <RowBody icon={<FileText size={18} aria-hidden />} title="Patient Terms" text={terms.text} warn={terms.outdated} />
        </LegalDocumentLink>
        <LegalDocumentLink slug="privacy-policy" className={rowClass}>
          <RowBody icon={<Lock size={18} aria-hidden />} title="Privacy Policy" text={privacy.text} warn={privacy.outdated} />
        </LegalDocumentLink>
        <SoonRow icon={<Bell size={18} aria-hidden />} title="Notifications" text="Visit updates and reminders" />
        <SoonRow icon={<MapPin size={18} aria-hidden />} title="Saved addresses" text="Faster booking next time" />
        <SoonRow icon={<CreditCard size={18} aria-hidden />} title="Saved payment methods" text="Faster checkout next time" />
      </Section>

      <Section title="Support">
        <a href={`mailto:${SUPPORT_EMAIL}`} className={rowClass}>
          <RowBody icon={<Mail size={18} aria-hidden />} title="Email support" text={SUPPORT_EMAIL} />
        </a>
        <div className="py-2.5">
          <SocialLinks />
        </div>
      </Section>

      <SignOutButton />
    </div>
  );
}

const rowClass = cx("flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-b-0", focusRing);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[26px]">
      <h2 className="mb-3 text-[17px] font-bold text-navy">{title}</h2>
      <Card padded={false} className="px-4 py-1">{children}</Card>
    </section>
  );
}

function RowBody({ icon, title, text, warn }: { icon: React.ReactNode; title: string; text: string; warn?: boolean }) {
  return (
    <>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-sky text-brand">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-ds-sm text-ink">{title}</b>
        <small className={`text-ds-xs ${warn ? "font-semibold text-warn" : "text-muted"}`}>{text}</small>
      </span>
      <ChevronRight size={20} className="flex-none text-muted" aria-hidden />
    </>
  );
}

function ListLink({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link href={href} className={rowClass}><RowBody icon={icon} title={title} text={text} /></Link>;
}

function SoonRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div aria-disabled="true" className="flex items-center gap-3 border-b border-line py-3.5 opacity-70 last:border-b-0">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-pending-bg text-pending">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-ds-sm text-pending">{title}</b>
        <small className="text-ds-xs text-muted">{text}</small>
      </span>
      <span className="rounded-md bg-pending-bg px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-pending">Soon</span>
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-muted">{children}</span>;
}

function Tags({ items }: { items: string[] | null }) {
  if (!items?.length) return <Muted>None recorded</Muted>;
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {items.map(t => <span key={t} className="rounded-[10px] bg-page px-2.5 py-[5px] text-ds-xs font-bold text-navy">{t}</span>)}
    </span>
  );
}

function acceptanceStatus(
  verb: string,
  version: string | null | undefined,
  at: string | null | undefined,
  current: string,
): { text: string; outdated: boolean } {
  const date = formatLegalDate(at);
  if (!version || !date) return { text: `Not yet ${verb.toLowerCase()}`, outdated: true };
  return {
    text: `${verb} version ${version} on ${date}${version !== current ? ` · version ${current} awaiting review` : ""}`,
    outdated: version !== current,
  };
}
