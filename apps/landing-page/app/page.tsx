import Button from "@/components/Button";
import Chip from "@/components/Chip";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

const STEPS = [
  {
    n: "01",
    title: "Request",
    icon: "/images/icon-request.svg",
    text: "Book on the app or website. We match you with the nearest verified doctor, nurse or physiotherapist.",
    featured: true,
  },
  {
    n: "02",
    title: "Visit",
    icon: "/images/icon-visit.svg",
    text: "Your Provider comes to you and logs vitals, notes and a treatment plan in the app.",
  },
  {
    n: "03",
    title: "Follow-Through",
    icon: "/images/icon-follow.svg",
    text: "Labs, prescriptions and hospital referrals are coordinated with partner facilities as needed.",
  },
];

export default function Home() {
  return (
    <main>
      <Nav />

      {/* ───────── HERO ───────── */}
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          <img src="/images/hero.png" alt="" />
        </div>
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-content anim-stagger">
            <div className="hero-badge">
              <img src="/images/icon-badge.svg" alt="" width={16} height={16} />
              <span>Verified care, brought to you</span>
            </div>

            <h1 className="hero-title">
              Healthcare at your <span>convenience.</span>
            </h1>

            <p className="hero-text">
              Licensed doctors, nurses and physiotherapists who come to you, with labs, pharmacy
              <br className="br-desktop" /> delivery and hospital referrals coordinated in one visit.
            </p>

            <div className="btn-row">
              <Button href={LINKS.bookApp}>Book via app</Button>
              <Button href={LINKS.bookWeb} variant="outline">
                Book via website
              </Button>
            </div>

            <div className="hero-alert">
              <img src="/images/icon-alert.svg" alt="" width={20} height={20} />
              <p>
                <strong>Not for emergencies.</strong> In an emergency, call 112 or go to the nearest emergency room.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── SAFETY ───────── */}
      <section className="safety">
        <div className="container safety-row">
          <div className="safety-lead" data-reveal="left">
            <img src="/images/icon-shield.svg" alt="" width={32} height={32} />
            <p>
              <span>Licensed.</span> <span>Verified.</span> <span>Accountable.</span>
            </p>
          </div>
          <p className="safety-text" data-reveal style={delay(120)}>
            Every Provider is licensed and verified with their regulator (MDCN for doctors, NMCN for nurses, MRTB for
            physiotherapists) before taking a booking.
          </p>
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section className="how" id="how-it-works">
        <div className="container">
          <div className="how-head" data-reveal>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 className="section-title">
              From health concern to completed care, without leaving home.
            </h2>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className={`step ${s.featured ? "step-featured" : ""}`}
                data-reveal
                style={delay(i * 130)}
              >
                <div className="step-top">
                  <div className="step-meta">
                    <span className="step-num">{s.n}</span>
                    <span className="step-icon">
                      <img src={s.icon} alt="" width={20} height={20} />
                    </span>
                  </div>
                  <h3 className="step-title">{s.title}</h3>
                </div>
                <p className="step-text">{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── WHAT WE ARE ───────── */}
      <section className="wwa" id="about">
        <div className="wwa-grid" aria-hidden="true" />
        <div className="container wwa-row">
          <div className="mosaic" data-reveal="left">
            <img className="mosaic-img" src="/images/what-we-are.png" alt="A StreetdocMD provider with a patient at home" />
            <Chip className="m-pharmacy" icon="/images/icon-pharmacy.svg" label="Partner Pharmacies" tall />
            <Chip className="m-labs" icon="/images/icon-labs.svg" label="Partner Labs" />
            <Chip className="m-verified" icon="/images/icon-verified.svg" label="Verified Partners" />
            <Chip className="m-hospital" icon="/images/icon-hospital.svg" label="Hospital Referrals" tall />
          </div>

          <div className="wwa-copy" data-reveal="right" style={delay(150)}>
            <div className="wwa-head">
              <p className="eyebrow eyebrow-light">WHAT WE ARE</p>
              <h2 className="section-title wwa-title">A platform that connects you to care — not a clinic.</h2>
            </div>
            <p className="wwa-text">
              StreetdocMD is a technology platform connecting you with independent, licensed professionals and Facility
              Partners. We don’t practise medicine, employ clinicians or direct their judgment. Clinical decisions are
              between you and your Provider or Facility Partner.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="cta" id="who-its-for">
        <div className="cta-card" data-reveal="zoom">
          <img className="cta-heart" src="/images/icon-heart.svg" alt="" width={360} height={360} />
          <div className="cta-content">
            <h2 className="cta-title">Care when you need it, not when a clinic has an opening</h2>
            <p className="cta-text">On your schedule, wherever you are.</p>
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
