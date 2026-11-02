import type { Metadata } from "next";
import Button from "@/components/Button";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WaitlistForm from "@/components/WaitlistForm";
import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

export const metadata: Metadata = {
  title: "Contact — StreetdocMD",
  description:
    "Book a walkthrough, ask about becoming a Provider, or explore a laboratory, pharmacy, or hospital partnership.",
};

const EMAIL = "contact@streetdocmd.com";

const CHANNELS = [
  {
    title: "General Enquiries",
    text: "Questions about StreetdocMD, the waitlist, or anything else.",
    icon: "/images/contact-icon-email.svg",
  },
  {
    title: "Provider Partnerships",
    text: "Independent doctors, nurses and physiotherapists.",
    icon: "/images/about-icon-verified.svg",
  },
  {
    title: "Laboratory, Pharmacy & Hospital Partnerships",
    text: "Facilities joining the connected care system.",
    icon: "/images/contact-icon-handshake.svg",
  },
];

export default function ContactPage() {
  return (
    <main>
      <Nav />

      {/* ───────── Hero ───────── */}
      <section className="contact-hero">
        <div className="contact-hero-inner">
          <div className="contact-hero-copy">
            <h1 className="about-hero-title">Talk to the StreetdocMD team.</h1>
            <p className="contact-hero-text">
              Book a walkthrough, ask about becoming a Provider, or explore a laboratory, pharmacy, or hospital
              partnership.
            </p>
            <div className="hero-alert">
              <img src="/images/contact-icon-alert.svg" alt="" width={20} height={20} />
              <p>
                <strong>Not for medical emergencies.</strong> If you or someone with you is having a medical emergency,
                call 112 or go to the nearest emergency room immediately.
              </p>
            </div>
          </div>
          <div className="about-collage" data-reveal="right">
            <div className="about-collage-col">
              <img src="/images/about-doctor-visit.jpg" alt="A doctor arriving for a home visit" />
              <img src="/images/about-lab-partner.jpg" alt="A laboratory technician at work" />
            </div>
            <div className="about-collage-col is-offset">
              <img src="/images/about-physio-care.jpg" alt="A physiotherapist treating a patient" />
              <img src="/images/about-nurse-home-visit.jpg" alt="A nurse visiting a patient at home" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Waitlist ───────── */}
      <section className="contact-join" id="waitlist">
        <div className="contact-join-inner">
          <div className="contact-join-head" data-reveal>
            <h2>Join the first cohort.</h2>
            <p>We’re onboarding an initial group of patients, Providers, and Facility Partners directly into active service.</p>
          </div>
          <WaitlistForm />
        </div>
      </section>

      {/* ───────── Channels ───────── */}
      <section className="about-principles" id="channels">
        <div className="about-principles-inner">
          <div className="about-principles-head" data-reveal>
            <h2>Our direct channels</h2>
          </div>
          <ul className="about-principle-grid">
            {CHANNELS.map((c, i) => (
              <li key={c.title} className="about-principle contact-channel" data-reveal style={delay((i % 2) * 100)}>
                <span className="about-principle-icon">
                  <img src={c.icon} alt="" />
                </span>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <a className="contact-channel-link" href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </li>
            ))}
            <li className="about-principle contact-channel" data-reveal style={delay(100)}>
              <span className="about-principle-icon contact-icon-location">
                <img src="/images/contact-icon-location.svg" alt="" />
              </span>
              <h3>Location</h3>
              <p>Want to meet with us?</p>
              <span className="contact-channel-link">Nigeria</span>
            </li>
          </ul>
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
              <Button href={LINKS.waitlist}>Join the waitlist</Button>
              <Button href="#channels" variant="outline">
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
