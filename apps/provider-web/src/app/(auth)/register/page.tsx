import Link from "next/link";
import { Activity, Building2, FlaskConical, HeartPulse, Pill, Stethoscope, type LucideIcon } from "lucide-react";
import AuthBrand from "@/components/AuthBrand";
import { cx, focusRing } from "@/components/ds";

const FACILITY_REGISTRATION_URL = "https://admin.streetdocmd.com/register/facility";

type Role = { label: string; desc: string; reg: string; icon: LucideIcon; href: string };

// The design's six provider types, in two groups. Individuals register here;
// facilities on the partner registration form (it opens on the chosen type).
const INDIVIDUALS: Role[] = [
  { label: "Doctor", desc: "Home consultations, prescriptions and referrals.", reg: "MDCN", icon: Stethoscope,
    href: `/register/individual?specialty=${encodeURIComponent("Medical Doctor (General)")}` },
  { label: "Nurse", desc: "Dressings, post surgical checks and care at home.", reg: "NMCN", icon: HeartPulse,
    href: `/register/individual?specialty=${encodeURIComponent("Registered Nurse")}` },
  { label: "Physiotherapist", desc: "Assessments, exercise plans and follow up sessions.", reg: "MRTB", icon: Activity,
    href: `/register/individual?specialty=${encodeURIComponent("Physiotherapist")}` },
];

const FACILITIES: Role[] = [
  { label: "Pharmacy", desc: "Stock, medicine orders and delivery.", reg: "PCN", icon: Pill,
    href: `${FACILITY_REGISTRATION_URL}?type=pharmacy` },
  { label: "Diagnostic lab", desc: "Sample collection, test processing and results.", reg: "MLSCN", icon: FlaskConical,
    href: `${FACILITY_REGISTRATION_URL}?type=lab` },
  { label: "Hospital", desc: "Capacity, referrals and specialist clinics.", reg: "Ministry of Health", icon: Building2,
    href: `${FACILITY_REGISTRATION_URL}?type=hospital` },
];

function RoleGroup({ title, description, roles, className }: {
  title: string; description: string; roles: Role[]; className?: string;
}) {
  const headingId = `group-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-[17px] font-bold text-navy">{title}</h2>
      <p className="mb-3 mt-0.5 text-ds-xs text-muted">{description}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {roles.map(({ label, desc, reg, icon: Icon, href }) => {
          const className = cx(
            "grid min-w-0 content-start gap-3 rounded-ds-lg border-[1.5px] border-line bg-surface px-3.5 py-4 text-left transition-colors hover:border-teal-deep hover:bg-teal-soft",
            focusRing,
          );
          const body = (
            <>
              <span className="grid h-[46px] w-[46px] place-items-center rounded-ds bg-teal-soft text-teal-deep"><Icon size={22} aria-hidden /></span>
              <span>
                <b className="block text-ds-control text-navy">{label}</b>
                <small className="mt-0.5 block text-ds-xs leading-snug text-muted">{desc}</small>
              </span>
              <span className="justify-self-start rounded-pill bg-teal-tint px-2.5 py-[5px] text-ds-xs font-bold text-teal-deep">{reg}</span>
            </>
          );
          return href.startsWith("http")
            ? <a key={label} href={href} className={className}>{body}</a>
            : <Link key={label} href={href} className={className}>{body}</Link>;
        })}
      </div>
    </section>
  );
}

export default function RegisterFork() {
  return (
    <div className="w-full max-w-2xl">
      <AuthBrand subtitle="Join as a provider" />

      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Choose your provider type</h1>
      <p className="mb-6 mt-1.5 text-ds-sm text-muted">
        We tailor your dashboard and checks to your type, and ask for the right licence.
      </p>

      <RoleGroup
        title="Individual practitioners"
        description="Licensed professionals who visit patients at home."
        roles={INDIVIDUALS}
      />
      <RoleGroup
        title="Facilities"
        description="Pharmacies, labs and hospitals that partner with StreetdocMD."
        roles={FACILITIES}
        className="mt-7"
      />

      <p className="mt-6 text-center text-ds-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
