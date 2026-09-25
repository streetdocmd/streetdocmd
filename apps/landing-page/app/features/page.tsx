import type { Metadata } from "next";
import Button from "@/components/Button";
import CareAccordion, { type CareItem } from "@/components/CareAccordion";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

export const metadata: Metadata = {
  title: "Features — StreetdocMD",
  description:
    "From first symptom to finished treatment, StreetdocMD coordinates your Provider, your lab, your pharmacy, and — where needed — a hospital.",
};

const JOURNEY = [
  { n: "01", title: "Request", text: "Tell us what you need", icon: "/images/icon-step-request.svg", framed: true },
  { n: "02", title: "Get matched", text: "A verified Provider responds", icon: "/images/icon-dispatch.svg" },
  { n: "03", title: "Receive care", text: "At home or through a partner", icon: "/images/icon-receive.svg" },
  { n: "04", title: "Stay connected", text: "Every next step in one record", icon: "/images/icon-connected.svg" },
];

// Copy from the Figma "Roll-out" component sets (Open variants).
const CARE_NETWORK: CareItem[] = [
  {
    title: "Provider Matching & Dispatch",
    description:
      "Automated, proximity-based dispatch offers your booking to the nearest available, verified Provider — doctor, nurse, or physiotherapist — matched to your need and their scope of practice.",
    points: ["Verified licensure", "Same-day Visits", "Scheduled recurring care"],
    icon: "/images/icon-dispatch.svg",
    check: "/images/check-dispatch.svg",
    bg: "#eff6fd",
    chip: "#d6ebff",
    text: "#0066cd",
  },
  {
    title: "In-home Visits",
    description:
      "Providers log your visit as it happens — vitals, notes, and a clear treatment plan — directly into your ongoing health record.",
    points: ["Live vitals logging", "Clear treatment plans", "Caregiver access with consent"],
    icon: "/images/icon-home.svg",
    check: "/images/check-home.svg",
    insetIcon: true,
    bg: "#ebfef2",
    chip: "#c6f4d7",
    text: "#6dc88f",
  },
  {
    title: "Pharmacy & Medication",
    description:
      "Digital prescriptions route to registered partner pharmacies for genuine, in-date, NAFDAC-compliant medication.",
    points: ["E-Prescriptions", "Deliver or pickup", "Refill reminders"],
    icon: "/images/icon-pharmacy-med.svg",
    check: "/images/check-pharmacy.svg",
    bg: "#ffeee5",
    chip: "#ffdecd",
    text: "#ff5900",
  },
  {
    title: "Laboratory Integration",
    description:
      "Tests ordered by your Provider are sent to an accredited partner laboratory, with collection options and results connected to your care record.",
    points: ["Home or In-lab collection", "Digital results", "Provider-linked follow-up"],
    icon: "/images/icon-lab.svg",
    check: "/images/check-lab.svg",
    bg: "#fbfaec",
    chip: "#faf9d8",
    text: "#ffcc00",
  },
  {
    title: "Hospital Referral",
    description:
      "When your condition needs a higher level of care, your Provider can refer you directly to a partner hospital through the platform.",
    points: ["Real-Time Bed & Service Availability", "Warm Handoff", "Discharge Summary"],
    icon: "/images/icon-hospital-ref.svg",
    check: "/images/check-hospital.svg",
    bg: "#ffeaeb",
    chip: "#fedcde",
    text: "#e42d35",
  },
  {
    title: "Care Records & History",
    description:
      "Every visit, lab result, and prescription lives in one continuous record, visible to you and to any approved relative and Provider you authorise.",
    points: ["Unified Timeline", "Exportable Summaries", "Provider Handoffs"],
    icon: "/images/icon-records.svg",
    check: "/images/check-records.svg",
    bg: "#fceaf5",
    chip: "#fcdff2",
    text: "#f858bc",
  },
  {
    title: "Payments & Coverage",
    description:
      "Transparent, upfront pricing for visits, tests, and deliveries, with payment collected securely through Paystack.",
    points: ["Upfront Pricing", "Secure Payments", "Fair Cancellation Terms"],
    icon: "/images/icon-payments.svg",
    check: "/images/check-payments.svg",
    bg: "#f8f2ff",
    chip: "#ece1fa",
    text: "#8a38f5",
  },
];

// The Figma "Compliance Anchors" section currently repeats the care-network cards.
// Replace these with your compliance items once they're final.
const COMPLIANCE: CareItem[] = CARE_NETWORK;

export default function FeaturesPage() {
  return (
    <main>
      <Nav />

      {/* ───────── HERO ───────── */}
      <section className="f-hero">
        <div className="container f-hero-row">
          <div className="f-hero-copy anim-stagger">
            <div className="f-hero-head">
              <p className="f-eyebrow">
                <img src="/images/icon-eyebrow.svg" alt="" width={16} height={16} />
                COORDINATED CARE, WHEREVER YOU ARE
              </p>
              <h1 className="f-hero-title">One Platform Connecting Every Part Of Your Care.</h1>
            </div>
            <p className="f-hero-text">
              From first symptom to finished treatment, StreetdocMD coordinates your Provider, your lab, your pharmacy,
              and — where needed — a hospital, so nothing falls through the cracks.
            </p>
            <div className="btn-row">
              <Button href={LINKS.bookApp}>Book via app</Button>
              <Button href={LINKS.bookWeb} variant="outline">
                Book via website
              </Button>
            </div>
          </div>
          <div className="f-hero-media anim-hero-media">
            <img src="/images/features-hero.png" alt="A StreetdocMD provider reviewing results with a patient and family at home" />
          </div>
        </div>
      </section>

      {/* ───────── ONE CONNECTED JOURNEY ───────── */}
      <section className="f-journey">
        <div className="container">
          <div className="f-split-head" data-reveal>
            <div className="f-split-title">
              <p className="f-eyebrow">ONE CONNECTED JOURNEY</p>
              <h2 className="f-title-64">Care That Keeps Moving Forward.</h2>
            </div>
            <p className="f-split-text">
              Your care should not stop at the consultation. StreetdocMD keeps every next step connected, visible, and
              easier to act on.
            </p>
          </div>

          <div className="journey">
            {JOURNEY.map((j, i) => (
              <article key={j.n} className="journey-card" data-reveal style={delay(i * 110)}>
                <div className="journey-top">
                  <div className="journey-row">
                    {j.framed ? (
                      <img src={j.icon} alt="" width={36} height={36} />
                    ) : (
                      <span className="journey-chip">
                        <img src={j.icon} alt="" width={20} height={20} />
                      </span>
                    )}
                    <span className="journey-num">{j.n}</span>
                  </div>
                  <h3 className="journey-title">{j.title}</h3>
                </div>
                <p className="journey-text">{j.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── COMPLETE CARE NETWORK ───────── */}
      <section className="f-network">
        <div className="container">
          <div className="f-network-head" data-reveal>
            <p className="f-eyebrow">THE COMPLETE CARE NETWORK</p>
            <h2 className="f-title-64">Everything Your Care Needs, Working Together.</h2>
          </div>
          <CareAccordion items={CARE_NETWORK} />
        </div>
      </section>

      {/* ───────── COMPLIANCE ANCHORS ───────── */}
      <section className="f-network f-compliance">
        <div className="container">
          <div className="f-split-head" data-reveal>
            <div className="f-split-title">
              <p className="f-eyebrow">COMPLIANCE ANCHORS</p>
              <h2 className="f-title-48">Care Built On Recognised Standards.</h2>
            </div>
            <p className="f-split-text">
              Built around the regulatory frameworks our Providers and Facility Partners answer to.
            </p>
          </div>
          <CareAccordion items={COMPLIANCE} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
