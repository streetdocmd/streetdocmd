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
    "StreetdocMD coordinates your Provider, lab, pharmacy and, if needed, a hospital, from first symptom to finished treatment.",
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
    points: ["Verified licensure", "Same-day visits", "Scheduled recurring care"],
    icon: "/images/icon-dispatch.svg",
    check: "/images/check-dispatch.svg",
    bg: "#eff6fd",
    chip: "#d6ebff",
    text: "#0066cd",
  },
  {
    title: "In-home Visits",
    description:
      "Vitals, notes and your treatment plan are logged live into your health record.",
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
      "E-prescriptions go to registered partner pharmacies for genuine, NAFDAC-compliant medicine.",
    points: ["E-prescriptions", "Delivery or pickup", "Refill reminders"],
    icon: "/images/icon-pharmacy-med.svg",
    check: "/images/check-pharmacy.svg",
    bg: "#ffeee5",
    chip: "#ffdecd",
    text: "#ff5900",
  },
  {
    title: "Laboratory Integration",
    description:
      "Tests go to accredited partner labs, with results linked to your care record.",
    points: ["Home or in-lab collection", "Digital results", "Provider-linked follow-up"],
    icon: "/images/icon-lab.svg",
    check: "/images/check-lab.svg",
    bg: "#fbfaec",
    chip: "#faf9d8",
    text: "#ffcc00",
  },
  {
    title: "Hospital Referral",
    description:
      "If you need a higher level of care, your Provider refers you straight to a partner hospital.",
    points: ["Live bed availability", "Warm handoff", "Discharge summary"],
    icon: "/images/icon-hospital-ref.svg",
    check: "/images/check-hospital.svg",
    bg: "#ffeaeb",
    chip: "#fedcde",
    text: "#e42d35",
  },
  {
    title: "Care Records & History",
    description:
      "Every visit, result and prescription in one record, shared only with people you approve.",
    points: ["Unified timeline", "Exportable summaries", "Provider handoffs"],
    icon: "/images/icon-records.svg",
    check: "/images/check-records.svg",
    bg: "#fceaf5",
    chip: "#fcdff2",
    text: "#f858bc",
  },
  {
    title: "Payments & Coverage",
    description:
      "Upfront prices for visits, tests and deliveries, paid securely through Paystack.",
    points: ["Upfront pricing", "Secure payments", "Fair cancellation terms"],
    icon: "/images/icon-payments.svg",
    check: "/images/check-payments.svg",
    bg: "#f8f2ff",
    chip: "#ece1fa",
    text: "#8a38f5",
  },
];

// The regulators behind the people and places on StreetdocMD (Figma "Compliance Anchors").
// Width and height are each logo's size in the design.
const REGULATORS = [
  { src: "/images/compliance-mdcn.png", alt: "Medical and Dental Council of Nigeria", w: 93, h: 86 },
  { src: "/images/compliance-nmcn.png", alt: "Nursing and Midwifery Council of Nigeria", w: 259, h: 71 },
  { src: "/images/compliance-mlscn.png", alt: "Medical Laboratory Science Council of Nigeria", w: 75, h: 75 },
  { src: "/images/compliance-nafdac.png", alt: "National Agency for Food and Drug Administration and Control (NAFDAC)", w: 70, h: 71 },
  { src: "/images/compliance-mrtb.png", alt: "Medical Rehabilitation Therapists Board of Nigeria", w: 65, h: 100 },
  { src: "/images/compliance-pcn.png", alt: "Pharmacy Council of Nigeria", w: 260, h: 71 },
  { src: "/images/compliance-ndpc.png", alt: "Nigeria Data Protection Commission", w: 218, h: 71 },
];

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
              <Button href={LINKS.bookWeb}>Book via website</Button>
              <Button href="#journey" variant="outline">
                Learn more
              </Button>
            </div>
          </div>
          <div className="f-hero-media anim-hero-media">
            <img src="/images/features-hero.png" alt="A StreetdocMD provider reviewing results with a patient and family at home" />
          </div>
        </div>
      </section>

      {/* ───────── ONE CONNECTED JOURNEY ───────── */}
      <section className="f-journey" id="journey">
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
      <section className="f-compliance">
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
          <ul className="f-regulators" data-reveal style={delay(120)}>
            {REGULATORS.map(r => (
              <li key={r.src}>
                <img src={r.src} alt={r.alt} title={r.alt} width={r.w} height={r.h} style={{ width: r.w, aspectRatio: `${r.w} / ${r.h}` }} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="cta f-cta">
        <div className="cta-card" data-reveal="zoom">
          <img className="cta-heart" src="/images/features-pulse.svg" alt="" width={423} height={423} />
          <div className="cta-content">
            <h2 className="cta-title">Start with one request. Stay connected through every next step.</h2>
            <p className="cta-text">
              Book a walkthrough and see how StreetDocMD coordinates a full visit — Provider, lab, pharmacy, and hospital
              referral if needed.
            </p>
            <div className="btn-row">
              <Button href={LINKS.bookWeb} arrow>
                Book a visit
              </Button>
              <Button href={LINKS.providerSignup} variant="outline">
                Join as a provider
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
