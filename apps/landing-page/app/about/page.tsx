import type { Metadata } from "next";
import Button from "@/components/Button";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

export const metadata: Metadata = {
  title: "About — StreetdocMD",
  description:
    "StreetdocMD was built because good care shouldn’t depend on how far you can travel, or how long you can wait in a queue.",
};

const STEPS = [
  {
    n: "01",
    title: "Request",
    text: "Book through the app or on Website. Tell us what you need, and our dispatch matches you to the nearest available, verified doctor, nurse, or physiotherapist.",
    icon: "/images/about-icon-request.svg",
    featured: true,
  },
  {
    n: "02",
    title: "Visit",
    text: "Your Provider comes to you. Vitals, notes, and a treatment plan are logged in the app as the visit happens.",
    icon: "/images/about-icon-visit.svg",
  },
  {
    n: "03",
    title: "Follow-Through",
    text: "Lab tests, prescriptions, and hospital referrals are coordinated with trusted partner facilities whenever they are needed.",
    icon: "/images/about-icon-follow.svg",
  },
];

// The lock and siren artwork is 20px, inset within the design's 24px icon box
const PRINCIPLES = [
  {
    title: "Verified, independent care",
    text: "Every Provider and Facility Partner is credential-checked against their Nigerian regulatory body before they can accept a booking or referral — and they remain independently, personally responsible for the care they deliver.",
    icon: "/images/about-icon-verified.svg",
  },
  {
    title: "A continuous record",
    text: "A patient’s history should follow them between Providers, not reset with every new visit.",
    icon: "/images/about-icon-record.svg",
  },
  {
    title: "Not for emergencies, and honest about it",
    text: "StreetdocMD is built for scheduled and on-demand non-emergency care. We’re direct with patients about calling 112 or going to the nearest emergency room when it’s urgent.",
    icon: "/images/about-icon-siren.svg",
    inset: true,
  },
  {
    title: "Data handled the way NDPA requires",
    text: "Patient information is used only for the service it was collected for, retained only as long as necessary, and never shared without consent — by us or by any Facility Partner.",
    icon: "/images/about-icon-lock.svg",
    inset: true,
  },
];

export default function AboutPage() {
  return (
    <main>
      <Nav />

      {/* ───────── Hero ───────── */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <div className="about-hero-copy">
            <h1 className="about-hero-title">Built to bring care wherever you are.</h1>
            <p className="about-hero-text">
              StreetdocMD was built because good care shouldn’t depend on how far you can travel, or how long you can
              wait in a queue.
            </p>
            <Button href={LINKS.bookWeb}>Join the waitlist</Button>
          </div>
          <div className="about-hero-media" data-reveal="zoom">
            <img src="/images/about-doctor-visit.jpg" alt="A doctor arriving for a home visit with a medical bag" />
            <div className="about-hero-chip">
              <img src="/images/about-icon-verified-chip.svg" alt="" width={34} height={34} />
              <div>
                <strong>Verified providers</strong>
                <span>Credentials checked before they accept a booking</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── The problem ───────── */}
      <section className="about-problem">
        <div className="about-problem-head" data-reveal>
          <div className="who-roles-title">
            <p className="who-eyebrow">THE PROBLEM</p>
            <h2>Care is fragmented. <br className="about-br" />It shouldn’t be.</h2>
          </div>
          <div className="about-problem-text">
            <p>
              A patient sees a doctor in one place, gets tested in another, and picks up medication somewhere else
              entirely — without a record connecting the three.
            </p>
            <p>StreetdocMD exists to close that gap, starting with the home visit.</p>
          </div>
        </div>
        <ol className="about-steps">
          {STEPS.map((s, i) => (
            <li key={s.n} className={`about-step ${s.featured ? "is-featured" : ""}`} data-reveal style={delay(i * 100)}>
              <div className="about-step-top">
                <span className="about-step-n">{s.n}</span>
                <span className="about-step-icon">
                  <img src={s.icon} alt="" width={20} height={20} />
                </span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── Principles ───────── */}
      <section className="about-principles">
        <div className="about-principles-inner">
          <div className="about-principles-head" data-reveal>
            <p className="who-eyebrow">CORE PRINCIPLES</p>
            <h2>Our operating principles</h2>
          </div>
          <ul className="about-principle-grid">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="about-principle" data-reveal style={delay((i % 2) * 100)}>
                <span className={`about-principle-icon ${p.inset ? "is-inset" : ""}`}>
                  <img src={p.icon} alt="" />
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── The horizon ───────── */}
      <section className="about-horizon">
        <div className="about-horizon-inner">
          <div className="about-collage" data-reveal="left">
            <div className="about-collage-col">
              <img src="/images/about-doctor-visit.jpg" alt="A doctor arriving for a home visit" />
              <img src="/images/about-lab-partner.jpg" alt="A laboratory technician at work" />
            </div>
            <div className="about-collage-col is-offset">
              <img src="/images/about-physio-care.jpg" alt="A physiotherapist treating a patient" />
              <img src="/images/about-nurse-home-visit.jpg" alt="A nurse visiting a patient at home" />
            </div>
          </div>
          <div className="about-horizon-copy" data-reveal style={delay(120)}>
            <p className="who-eyebrow">THE HORIZON</p>
            <h2>Starting with home visits. Building toward continuous care</h2>
            <p className="about-horizon-text">
              We’re starting with on-demand doctor, nurse, and physiotherapy visits, connected to laboratory, pharmacy,
              and hospital partners across Nigeria. From there, StreetdocMD is built to extend into chronic condition
              management and remote monitoring — care that continues between visits, not just during them.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="cta about-cta">
        <div className="cta-card" data-reveal="zoom">
          <img className="cta-heart" src="/images/about-pulse.svg" alt="" width={408} height={408} />
          <div className="cta-content">
            <h2 className="cta-title">Be part of the first cohort.</h2>
            <p className="cta-text">
              Join the first group of patients, Providers, and Facility Partners using StreetdocMD to coordinate
              home-based care from request to recovery.
            </p>
            <div className="btn-row">
              <Button href={LINKS.bookWeb}>Join the waitlist</Button>
              <Button href={LINKS.contact} variant="outline">
                Contact the team
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
