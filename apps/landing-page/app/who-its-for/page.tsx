import type { Metadata } from "next";
import Button from "@/components/Button";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

export const metadata: Metadata = {
  title: "Who It’s For — StreetdocMD",
  description:
    "StreetdocMD connects patients with independent, verified doctors, nurses, physiotherapists, laboratories, pharmacies, and hospitals in one coordinated system.",
};

const PROVIDER_REGISTER = `${LINKS.providerSignup}/register`;

const ROLES = [
  {
    title: "Patients and Families",
    icon: "/images/role-patients.svg",
    bg: "#eff6fd",
    chip: "#d6ebff",
    body: "Book an independent, verified Provider, get lab work done, and receive medications at home — all tracked in one place, and shareable with the family members helping manage your care.",
  },
  {
    title: "Doctors",
    icon: "/images/role-doctors.svg",
    bg: "#ebfef2",
    chip: "#c6f4d7",
    body: "Accept bookings that match your specialty, document visits and prescriptions in the app, and refer to labs, pharmacies, or hospitals without leaving the platform. You remain solely responsible for your own clinical decisions.",
  },
  {
    title: "Nurses",
    icon: "/images/role-nurses.svg",
    bg: "#ffeee5",
    chip: "#ffdecd",
    body: "Accept visit requests that match your scope of practice, log vitals and interventions on the spot, and carry out injection or wound-care tasks only where authorised by the prescribing Provider.",
  },
  {
    title: "Physiotherapists",
    icon: "/images/role-physiotherapists.svg",
    bg: "#ffeaeb",
    chip: "#fedcde",
    body: "Manage multi-session treatment plans, track patient progress visit over visit, and coordinate directly with the referring doctor.",
  },
  {
    title: "Laboratories",
    icon: "/images/role-laboratories.svg",
    bg: "#fbfaec",
    chip: "#faf9d8",
    body: "Receive investigation orders dispatched through the platform, dispatch a sample collector for home testing where offered, and upload results with reference ranges directly to the patient’s record.",
  },
  {
    title: "Pharmacies",
    icon: "/images/role-pharmacies.svg",
    bg: "#fceaf5",
    chip: "#fcdff2",
    body: "Receive e-prescriptions with full patient and Provider context attached, confirm pricing and stock, and dispense NAFDAC-compliant medication for delivery or pickup.",
  },
  {
    title: "Hospitals",
    icon: "/images/role-hospitals.svg",
    bg: "#f8f2ff",
    chip: "#ece1fa",
    body: "Receive referrals with relevant visit context already attached, confirm bed and service availability in real time, and send a discharge summary back to the referring Provider.",
  },
];

const AUDIENCES = [
  {
    eyebrow: "FOR PATIENTS & FAMILIES",
    heading: "Know what’s happening with your care, in real time.",
    body: "Track a booked visit from confirmation to arrival, and see lab results and prescriptions the moment they’re ready — no calling around to check.",
    chips: ["Live visit tracking", "One care timeline", "Family access"],
    cta: { label: "Find a doctor", href: LINKS.bookWeb },
    image: "/images/home-care.jpg",
    imageAlt: "A nurse visiting a family at home",
  },
  {
    eyebrow: "FOR DOCTORS, NURSES AND PHYSIOTHERAPISTS",
    heading: "Full context and autonomy for every visit, manage recurring visits.",
    body: "Arrive at a home visit with the patient’s history already loaded — past visits, current medications, and outstanding lab results — while StreetdocMD stays out of your clinical decisions as you also track progress alongside.",
    chips: ["Progress Tracking", "Recurring scheduling", "Direct referral"],
    cta: { label: "Find a doctor", href: LINKS.bookWeb },
    image: "/images/doctor-care.jpg",
    imageAlt: "A doctor reviewing patient records on a tablet",
  },
  {
    eyebrow: "FOR LABORATORIES, PHARMACIES & HOSPITALS",
    heading: "Structured referrals, fewer errors, faster settlement.",
    body: "Receive complete, digitally formatted orders and referrals, with patient details and Provider instructions attached automatically, and get paid on a predictable settlement schedule via Paystack.",
    chips: ["Complete orders", "Status updates", "Predictable settlement"],
    cta: { label: "Join as partner", href: PROVIDER_REGISTER },
    image: "/images/medical-team.jpg",
    imageAlt: "Nurses working together in a hospital",
  },
];

export default function WhoItsForPage() {
  return (
    <main>
      <Nav />

      {/* ───────── Hero ───────── */}
      <section className="who-hero">
        <img className="who-hero-img" src="/images/care-team.jpg" alt="A doctor and a nurse smiling in a clinic" />
        <div className="who-hero-glow" aria-hidden />
        <div className="who-hero-inner">
          <div className="who-hero-content">
            <h1 className="who-hero-title">Built for everyone involved in patient care.</h1>
            <p className="who-hero-text">
              StreetdocMD connects patients with independent, verified doctors, nurses, physiotherapists,
              laboratories, pharmacies, and hospitals — replacing scattered clinic visits and phone-tag
              follow-ups with one coordinated system.
            </p>
            <Button href={LINKS.bookWeb}>Get started</Button>
          </div>
        </div>
      </section>

      {/* ───────── Seven roles ───────── */}
      <section className="who-roles">
        <div className="who-roles-head" data-reveal>
          <div className="who-roles-title">
            <p className="who-eyebrow">A PLACE FOR YOU</p>
            <h2>Seven roles. One connected system.</h2>
          </div>
          <p className="who-roles-text">
            From the first appointment to the next step in care, everyone stays connected.
          </p>
        </div>

        {/* Scrolls sideways, so keyboard users need to be able to focus it */}
        <div className="who-roles-scroll" tabIndex={0} role="region" aria-label="The seven roles on StreetdocMD">
          <ul className="who-roles-list">
            {ROLES.map(r => (
              <li key={r.title} className="who-role" style={{ background: r.bg }}>
                <span className="who-role-icon" style={{ background: r.chip }}>
                  <img src={r.icon} alt="" width={32} height={32} />
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Audience rows ───────── */}
      <section className="who-audiences">
        <div className="who-audiences-inner">
          {AUDIENCES.map((row, i) => (
            <div key={row.eyebrow} className={`who-audience ${i % 2 ? "is-reversed" : ""}`}>
              <div className="who-audience-media" data-reveal={i % 2 ? "right" : "left"}>
                <img src={row.image} alt={row.imageAlt} />
              </div>
              <div className="who-audience-copy" data-reveal style={delay(120)}>
                <p className="who-eyebrow">{row.eyebrow}</p>
                <h3>{row.heading}</h3>
                <p className="who-audience-text">{row.body}</p>
                <ul className="who-chips">
                  {row.chips.map(c => <li key={c}>{c}</li>)}
                </ul>
                <Button href={row.cta.href}>{row.cta.label}</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="cta who-cta">
        <div className="cta-card" data-reveal="zoom">
          <img className="cta-heart" src="/images/cta-pulse.svg" alt="" width={360} height={360} />
          <div className="cta-content">
            <h2 className="cta-title">Find your place in connected care</h2>
            <p className="cta-text">For you, your practice, or your facility.</p>
            <div className="btn-row">
              <Button href={LINKS.bookWeb}>Get started</Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
