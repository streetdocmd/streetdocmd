import { LINKS } from "@/lib/links";
import { SOCIAL_LINKS, type SocialLink } from "@/lib/brand";

const SOCIAL_ICONS: Record<SocialLink["id"], { src: string; size: number }> = {
  x: { src: "/images/icon-x.svg", size: 24 },
  instagram: { src: "/images/icon-instagram.svg", size: 24 },
  tiktok: { src: "/images/icon-tiktok.svg", size: 16 },
  facebook: { src: "/images/icon-facebook.svg", size: 24 },
};
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
              <a href="/features">Platform</a>
              <a href="/#who-its-for">Who it’s for</a>
            </div>
            <div className="footer-col col-company">
              <h4>COMPANY</h4>
              <a href="/#about">About</a>
              <a href={LINKS.contact}>Contact</a>
            </div>
            <div className="footer-col col-legal">
              <h4>LEGAL</h4>
              <a href={LINKS.patientTerms}>Patient terms of service</a>
              <a href={LINKS.providerTerms}>Provider service agreement</a>
              <a href={LINKS.privacy}>Privacy policy</a>
              <a href={LINKS.facilityAgreement}>Facility partner agreement</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 StreetdocMD. Nigeria.</p>
          <div className="socials">
            {SOCIAL_LINKS.map(s => (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`StreetdocMD on ${s.label}`}>
                <img src={SOCIAL_ICONS[s.id].src} alt="" width={SOCIAL_ICONS[s.id].size} height={SOCIAL_ICONS[s.id].size} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
