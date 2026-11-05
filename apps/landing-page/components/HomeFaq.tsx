"use client";

import { useState } from "react";

// Answers are written from how the platform works today: provider-set rates,
// the 5 percent service charge on medicines and tests, family member bookings,
// and the regulators each provider is checked against.
const FAQS = [
  {
    q: "What is StreetdocMD?",
    a: "StreetdocMD is a technology platform that connects you with independent, licensed doctors, nurses and physiotherapists who visit you at home, and with partner laboratories, pharmacies and hospitals for anything your care needs next. We don’t practise medicine: your care is provided by your Provider.",
  },
  {
    q: "How does StreetdocMD work?",
    a: "Choose the visit you need, pick a verified provider near you, then choose a time and add your address. You see the price before you pay. Your provider comes to you, and their notes, prescriptions and any tests they order stay together in your record.",
  },
  {
    q: "Are StreetdocMD healthcare providers verified?",
    a: "Yes. Every provider is checked against their Nigerian regulatory body before they can accept a booking: MDCN for doctors, NMCN for nurses and MRTB for physiotherapists. We also review their qualifications and practising licence.",
  },
  {
    q: "What healthcare services can I receive at home?",
    a: "StreetdocMD connects you with verified healthcare professionals who can provide appropriate medical, nursing, or physiotherapy care in the comfort of your home, including consultations, wellness checks, wound care, elderly reviews, nursing care and physiotherapy.",
  },
  {
    q: "Is StreetdocMD for medical emergencies?",
    a: "No. StreetdocMD is for scheduled and on-demand non-emergency care. If you or someone with you is having a medical emergency, call 112 or go to the nearest emergency room immediately.",
  },
  {
    q: "How much does a StreetdocMD home visit cost?",
    a: "Each provider sets their own rate, and you see it before you book. You pay that rate with nothing added. Medicines and lab tests are priced by the pharmacy or lab, with a 5 percent service charge, and you see the full total before you pay.",
  },
  {
    q: "How quickly will a healthcare professional arrive?",
    a: "It depends on which providers are free near you. You can choose a provider who is available now, or book a time that suits you. Once your provider accepts, you can follow their journey to you in the app.",
  },
  {
    q: "Can I book a home visit for my parent or another family member?",
    a: "Yes. Add them as a family member in your account, with their own phone number so the provider can reach them, and choose them when you book.",
  },
  {
    q: "What happens if I need medication, laboratory tests, or hospital care?",
    a: "Where available, StreetdocMD can help coordinate laboratory testing and medication fulfilment. If hospital care is necessary, your provider can recommend an appropriate referral.",
  },
  {
    q: "Can I continue receiving care after my first visit?",
    a: "StreetdocMD is designed for continuity of care, not just one-off visits. Where appropriate, you can arrange follow-ups, continue with your provider, and keep your care journey connected through the platform.",
  },
];

// Desktop: questions on the left, the chosen answer in the card on the right.
// Narrow screens: each answer opens under its own question.
export default function HomeFaq() {
  const [active, setActive] = useState(0);

  return (
    <section className="faq" id="faqs">
      <div className="container faq-row">
        <div className="faq-questions" data-reveal>
          <h2 className="faq-title">FAQs.</h2>
          <ul className="faq-list">
            {FAQS.map((f, i) => {
              const open = i === active;
              return (
                <li key={f.q}>
                  <button
                    type="button"
                    className={`faq-q ${open ? "is-active" : ""}`}
                    aria-expanded={open}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setActive(i)}
                  >
                    <span>{f.q}</span>
                    {open && <img src="/images/faq-icon-active.svg" alt="" width={20} height={20} />}
                  </button>
                  <div id={`faq-a-${i}`} className="faq-inline" hidden={!open}>
                    {f.a}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* No scroll reveal: it's sticky, so the reveal can miss it and leave it faded */}
        <div className="faq-answers">
          <h2 className="faq-title">Answers.</h2>
          <div className="faq-card" aria-live="polite">
            <img src="/images/faq-icon-answer.svg" alt="" width={20} height={20} />
            <p>{FAQS[active].a}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
