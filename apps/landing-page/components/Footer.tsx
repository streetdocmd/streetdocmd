import { LINKS } from "@/lib/links";
import { delay } from "@/lib/reveal";

export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand" data-reveal>
            <img src="/images/logo-white.png" alt="StreetdocMD" width={464} height={186} />
            <p>Healthcare at your convenience</p>
          </div>

          <div className="footer-links" data-reveal style={delay(120)}>
            <div className="footer-col col-product">
              <h4>PRODUCT</h4>
              <a href="/features">PLATFORM</a>
              <a href="/#who-its-for">WHO IT’S FOR</a>
            </div>
            <div className="footer-col col-company">
              <h4>COMPANY</h4>
              <a href="/#about">ABOUT</a>
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
  );
}
