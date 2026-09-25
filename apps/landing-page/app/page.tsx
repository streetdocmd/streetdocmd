import Button from "@/components/Button";
import Chip from "@/components/Chip";
import { LINKS } from "@/lib/links";

const NAV_LINKS = [
  { label: "Features", href: "#how-it-works" },
  { label: "Who It’s For", href: "#who-its-for" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const STEPS = [
  {
    n: "01",
    title: "Request",
    icon: "/images/icon-request.svg",
    text: "Book through the app or on Website. Tell us what you need, and our dispatch matches you to the nearest available, verified doctor, nurse, or physiotherapist.",
    featured: true,
  },
  {
    n: "02",
    title: "Visit",
    icon: "/images/icon-visit.svg",
    text: "Your Provider comes to you. Vitals, notes, and a treatment plan are logged in the app as the visit happens.",
  },
  {
    n: "03",
    title: "Follow-Through",
    icon: "/images/icon-follow.svg",
    text: "Lab tests, prescriptions, and hospital referrals are coordinated with trusted partner facilities whenever they are needed.",
  },
];

export default function Home() {
  return (
    <main>
      {/* ───────── NAV ───────── */}
      <header className="nav">
        <a href="/" className="nav-logo" aria-label="StreetdocMD home">
          <img src="/images/logo.png" alt="StreetdocMD" width={200} height={80} />
        </a>
        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <Button href={LINKS.bookWeb} arrow>
          Book a visit
        </Button>
      </header>

      {/* ───────── HERO ───────── */}
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          <img src="/images/hero.png" alt="" />
        </div>
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <img src="/images/icon-badge.svg" alt="" width={16} height={16} />
              <span>Verified care, brought to you</span>
            </div>

            <h1 className="hero-title">
              Healthcare at your <span>convenience.</span>
            </h1>

            <p className="hero-text">
              StreetdocMD connects you to independent, licensed doctors, nurses,
              <br className="br-desktop" /> and physiotherapists who come to you — with lab testing, pharmacy
              <br className="br-desktop" /> delivery, and hospital referral (when necessary) coordinated through
              <br className="br-desktop" /> the same visit.
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
                <strong>Not for medical emergencies.</strong> If you or someone with you is having a medical
                <br className="br-desktop" /> emergency, call 112 or go to the nearest emergency room immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── SAFETY ───────── */}
      <section className="safety">
        <div className="container safety-row">
          <div className="safety-lead">
            <img src="/images/icon-shield.svg" alt="" width={32} height={32} />
            <p>
              <span>Licensed.</span> <span>Verified.</span> <span>Accountable.</span>
            </p>
          </div>
          <p className="safety-text">
            Every Provider on StreetdocMD is independently licensed and verified against their Nigerian regulatory body —
            MDCN for doctors, NMCN for nurses, MRTB for physiotherapists — before they can accept a single booking.
          </p>
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section className="how" id="how-it-works">
        <div className="container">
          <div className="how-head">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 className="section-title">
              Turn a health concern into completed care, without leaving your home.
            </h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <article key={s.n} className={`step ${s.featured ? "step-featured" : ""}`}>
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
          <div className="mosaic">
            <img className="mosaic-img" src="/images/what-we-are.png" alt="A StreetdocMD provider with a patient at home" />
            <Chip className="m-pharmacy" icon="/images/icon-pharmacy.svg" label="Partner Pharmacies" tall />
            <Chip className="m-labs" icon="/images/icon-labs.svg" label="Partner Labs" />
            <Chip className="m-verified" icon="/images/icon-verified.svg" label="Verified Partners" />
            <Chip className="m-hospital" icon="/images/icon-hospital.svg" label="Hospital Referrals" tall />
          </div>

          <div className="wwa-copy">
            <div className="wwa-head">
              <p className="eyebrow eyebrow-light">WHAT WE ARE</p>
              <h2 className="section-title wwa-title">A platform that connects you to care — not a clinic.</h2>
            </div>
            <p className="wwa-text">
              StreetdocMD is a technology platform. We connect you with independent, licensed healthcare professionals
              and independent Facility Partners — we don’t practice medicine, employ Providers as clinicians, or direct
              their clinical judgment. The care relationship, and the clinical decisions made in it, are between you and
              your Provider or Facility Partner.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="cta" id="who-its-for">
        <div className="cta-card">
          <img className="cta-heart" src="/images/icon-heart.svg" alt="" width={360} height={360} />
          <div className="cta-content">
            <h2 className="cta-title">Ready when you need care, not when a clinic has an opening</h2>
            <p className="cta-text">We handle your care at your convenience and on your schedule.</p>
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

      {/* ───────── FOOTER ───────── */}
      <footer className="footer" id="contact">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/images/logo-white.png" alt="StreetdocMD" width={464} height={186} />
              <p>Healthcare at your convenience</p>
            </div>

            <div className="footer-links">
              <div className="footer-col col-product">
                <h4>PRODUCT</h4>
                <a href="#how-it-works">PLATFORM</a>
                <a href="#who-its-for">WHO IT’S FOR</a>
              </div>
              <div className="footer-col col-company">
                <h4>COMPANY</h4>
                <a href="#about">ABOUT</a>
                <a href={LINKS.contact}>CONTACT</a>
              </div>
              <div className="footer-col col-legal">
                <h4>LEGAL</h4>
                <a href={LINKS.patientTerms}>PATIENT’S TERMS OF SERVICE</a>
                <a href={LINKS.providerTerms}>PROVIDER’S TERMS OF SERVICE</a>
                <a href={LINKS.privacy}>PRIVACY POLICY</a>
                <a href={LINKS.facilityAgreement}>FACILITY PARTNER AGREEMENT</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 StreetdocMD. Nigeria.</p>
            <div className="socials">
              <a href={LINKS.x} aria-label="StreetdocMD on X">
                <img src="/images/icon-x.svg" alt="" width={24} height={24} />
              </a>
              <a href={LINKS.instagram} aria-label="StreetdocMD on Instagram">
                <img src="/images/icon-instagram.svg" alt="" width={24} height={24} />
              </a>
              <a href={LINKS.tiktok} aria-label="StreetdocMD on TikTok">
                <img src="/images/icon-tiktok.svg" alt="" width={16} height={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
