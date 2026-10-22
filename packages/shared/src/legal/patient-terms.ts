import type { LegalDocument } from "./types";

// StreetdocMD Patient Terms of Service — Version 2.0 · 2026.
// Reproduced verbatim from the approved document. Do not reword; a material change needs a
// new version and fresh acceptance (clause 17.1).

export const PATIENT_TERMS: LegalDocument = {
  slug: "patient-terms",
  title: "Patient Terms of Service",
  subtitle: "Terms governing use of the StreetdocMD Platform",
  version: "2.0",
  versionLabel: "Version 2.0 · 2026",
  partyLine: "STREETDOC MD LTD · Registration No. 9797929 · Version 2.0 · 2026",
  intro: [
    { kind: "p", text: "These Terms govern your access to and use of the StreetdocMD healthcare technology platform, including www.streetdocmd.com and supported booking and communication channels. “StreetdocMD”, “we”, “us” and “our” refer to STREETDOC MD LTD. “Patient” and “you” refer to the person using the Platform or the person for whom an authorised booking is made." },
  ],
  sections: [
    {
      id: "acceptance",
      title: "1. Acceptance of These Terms",
      blocks: [
        { kind: "clause", num: "1.1", text: "You enter into these Terms by affirmatively accepting them during account registration or another Platform flow that clearly presents these Terms for acceptance. The acceptance control must be unchecked by default." },
        { kind: "clause", num: "1.2", text: "If you book or manage care for another person, you confirm that you have appropriate authority to do so. StreetdocMD may request reasonable evidence of that authority." },
        { kind: "clause", num: "1.3", text: "These Terms should be read with the StreetdocMD Privacy Policy. The Privacy Policy explains how personal and health information is handled; it is not itself a substitute for medical-treatment consent." },
      ],
    },
    {
      id: "what-we-are",
      title: "2. What StreetdocMD Is — and Is Not",
      blocks: [
        { kind: "clause", num: "2.1", text: "StreetdocMD is a healthcare technology and care-coordination platform that connects Patients with independent healthcare professionals, including doctors, nurses and physiotherapists (“Providers”), and facilitates access to independent laboratories, pharmacies and hospitals (“Facility Partners”)." },
        { kind: "clause", num: "2.2", text: "StreetdocMD does not itself practise medicine, nursing, physiotherapy, laboratory medicine, pharmacy or hospital care. Providers and Facility Partners remain responsible for the professional or clinical services they deliver, subject always to rights and liabilities that applicable law does not permit any party to exclude." },
        { kind: "clause", num: "2.3", text: "The Platform may use availability, location or proximity and other operational information to route a booking to a potentially available Provider. Matching is a technology function and is not a guarantee of a particular clinical outcome or a substitute for the Provider’s professional judgment." },
        { kind: "clause", num: "2.4", text: "Where a Provider or Facility Partner supplies healthcare or a related service, the professional/service relationship for that care is between you and that Provider or Facility Partner. StreetdocMD facilitates the Platform transaction and may charge its own separately disclosed Patient Service Fee." },
      ],
    },
    {
      id: "not-emergency",
      title: "3. Not an Emergency Service",
      blocks: [
        { kind: "callout", title: "IMPORTANT — STREETDOCMD IS NOT AN EMERGENCY SERVICE.", text: "If you believe you or another person is experiencing a medical emergency, seek immediate emergency assistance or go to an appropriate emergency healthcare facility. Do not wait for a StreetdocMD booking or Platform response." },
        { kind: "clause", num: "3.1", text: "StreetdocMD is intended for non-emergency healthcare. Provider availability and response times vary by location, time and circumstances and are not guaranteed." },
      ],
    },
    {
      id: "providers",
      title: "4. Providers",
      blocks: [
        { kind: "clause", num: "4.1", text: "Providers are independent healthcare professionals. StreetdocMD conducts onboarding and professional-verification processes appropriate to the Provider’s profession before Platform activation and may conduct re-verification." },
        { kind: "clause", num: "4.2", text: "The treating Provider is responsible for clinical assessment, diagnosis, treatment, prescriptions, referrals, clinical notes and professional conduct within the Provider’s lawful scope of practice." },
        { kind: "clause", num: "4.3", text: "StreetdocMD may assist with complaints, communication and relevant Platform records, but does not replace the jurisdiction of professional regulators, courts or other lawful complaint and redress mechanisms." },
      ],
    },
    {
      id: "facility-partners",
      title: "5. Facility Partners, Home Collection and Delivery",
      blocks: [
        { kind: "clause", num: "5.1", text: "Laboratories, pharmacies and hospitals available through the Platform are independent Facility Partners. Each Facility Partner sets its own prices and remains responsible for the service, product or care it supplies." },
        { kind: "clause", num: "5.2", text: "A laboratory may offer home sample collection and may charge a separately disclosed collection fee. The laboratory is responsible for the phlebotomist or other collection personnel it engages, including appropriate qualification, identity, conduct, infection-control practices and specimen handling and transport." },
        { kind: "clause", num: "5.3", text: "A pharmacy may offer medicine delivery and may charge a separately disclosed delivery or dispatch fee. The pharmacy is responsible for its rider, courier or delivery provider and for appropriate packaging, handling and delivery of the medicines." },
        { kind: "clause", num: "5.4", text: "StreetdocMD does not become the employer or clinical/logistics provider of Facility Partner personnel merely because a booking, payment or communication is facilitated through the Platform." },
      ],
    },
    {
      id: "your-responsibilities",
      title: "6. Your Responsibilities",
      blocks: [
        {
          kind: "bullets",
          items: [
            "Provide accurate and current identity, contact, location and relevant health information.",
            "Review booking details, prices and disclosed fees before confirming payment.",
            "Be present and reasonably accessible at the confirmed location and time.",
            "Provide a reasonably safe environment for a home visit and treat Providers, Facility Partner personnel and StreetdocMD personnel respectfully.",
            "Use the Platform only for lawful healthcare purposes and do not seek medicines, tests, prescriptions or documents through fraud or misrepresentation.",
            "Keep your account credentials secure and promptly report suspected unauthorised use.",
          ],
        },
        { kind: "clause", num: "6.1", text: "Providers and Facility Partners may reasonably rely on information you provide. Nothing in this clause excludes a responsibility that applicable law places on StreetdocMD, a Provider or a Facility Partner." },
      ],
    },
    {
      id: "prices-fees-payment",
      title: "7. Prices, Fees and Payment",
      blocks: [
        { kind: "clause", num: "7.1", text: "Before you confirm a transaction, the Platform will display the applicable charges available to StreetdocMD, which may include: (a) the Provider consultation fee or Facility Partner price; (b) any laboratory home-collection or pharmacy delivery/dispatch fee; (c) the separate StreetdocMD Patient Service Fee; and (d) applicable taxes or other charges that must lawfully be disclosed." },
        { kind: "clause", num: "7.2", text: "StreetdocMD does not charge Facility Partners a percentage commission on their Facility Price. Facility Partners bear applicable Paystack or replacement payment-processing charges attributable to payments collected for them, in accordance with StreetdocMD’s arrangements with those Facility Partners." },
        { kind: "clause", num: "7.3", text: "The price presented for your confirmation is the price applicable to that transaction unless a lawful correction or adjustment is clearly disclosed and accepted before the transaction is completed. A Provider or Facility Partner may update future prices, but may not retrospectively increase an amount already confirmed and paid." },
        { kind: "clause", num: "7.4", text: "Payments may be processed through Paystack or another payment processor notified through the Platform. Payment processing may be subject to the processor’s applicable terms and technical processing times." },
      ],
    },
    {
      id: "cancellation-refunds",
      title: "8. Cancellation, Non-Delivery and Refunds",
      blocks: [
        { kind: "clause", num: "8.1", text: "You may cancel an advance booking subject to any reasonable cancellation terms clearly disclosed before booking. Any cancellation charge will be applied only to the extent permitted by applicable law and reasonably connected to the circumstances of the cancellation." },
        { kind: "clause", num: "8.2", text: "If a paid service cannot be supplied because StreetdocMD cannot complete the Platform arrangement, a confirmed Provider fails to attend without reasonable cause, or a Facility Partner does not provide the paid service or product, the affected amount will be eligible for refund, subject to verification and any lawful exception." },
        { kind: "clause", num: "8.3", text: "If a home-collection or delivery service has not been performed, the corresponding ancillary fee will ordinarily be refunded with the affected service. Where personnel have already been dispatched or material cost has reasonably been incurred before a Patient cancellation, any retained amount must be consistent with a cancellation term disclosed before payment and applicable law." },
        { kind: "clause", num: "8.4", text: "If you are absent, unreachable, provide a materially incorrect address, or otherwise prevent a booked service from proceeding, a reasonable disclosed no-show or cancellation charge may apply." },
        { kind: "clause", num: "8.5", text: "Duplicate payments, confirmed payment errors and valid payment reversals will be corrected or refunded as appropriate. Refunds are normally returned through the original payment channel and remain subject to banking/payment-processor processing times." },
        { kind: "clause", num: "8.6", text: "A complaint about clinical quality, a test result, medicine or professional judgment is not automatically a payment reversal. StreetdocMD may help review the transaction and facilitate communication while preserving your rights against the responsible Provider or Facility Partner and any statutory consumer rights." },
      ],
    },
    {
      id: "availability-outcomes",
      title: "9. Service Availability and Clinical Outcomes",
      blocks: [
        { kind: "clause", num: "9.1", text: "Availability varies by location, time, Provider capacity, Facility Partner stock and other operational factors. StreetdocMD does not guarantee that a particular Provider, Facility Partner or service will always be available." },
        { kind: "clause", num: "9.2", text: "Where continuity with a previous Provider is requested, StreetdocMD may try to facilitate it, but availability is not guaranteed and an appropriately qualified alternative may be offered." },
        { kind: "clause", num: "9.3", text: "No particular clinical outcome is guaranteed. Healthcare outcomes depend on individual circumstances and professional care." },
      ],
    },
    {
      id: "eligibility",
      title: "10. Eligibility, Family Members and Dependants",
      blocks: [
        { kind: "clause", num: "10.1", text: "You must be at least 18 years old to create your own StreetdocMD account unless the Platform expressly introduces another legally compliant account pathway." },
        { kind: "clause", num: "10.2", text: "Care for a minor or another person who cannot manage their own booking must be arranged by an appropriately authorised parent, guardian, caregiver or representative. Medical-treatment consent remains subject to the treating professional’s legal and professional obligations." },
      ],
    },
    {
      id: "privacy-records",
      title: "11. Privacy and Clinical Records",
      blocks: [
        { kind: "clause", num: "11.1", text: "Personal and health information is handled in accordance with the StreetdocMD Privacy Policy and applicable law." },
        { kind: "clause", num: "11.2", text: "StreetdocMD may act as a controller or processor depending on the processing activity. Providers and Facility Partners may also have independent controller and professional record-keeping responsibilities for the care or services they provide." },
        { kind: "clause", num: "11.3", text: "Providers remain responsible for the clinical accuracy of the notes, diagnoses, prescriptions and treatment records they author." },
      ],
    },
    {
      id: "prohibited-conduct",
      title: "12. Prohibited Conduct and Account Action",
      blocks: [
        {
          kind: "bullets",
          items: [
            "Fraudulent bookings, impersonation or unauthorised use of another person’s identity.",
            "Using the Platform to obtain medicines, tests, prescriptions or documentation through deception.",
            "Threatening, harassing or abusive conduct toward Providers, Facility Partner personnel or StreetdocMD personnel.",
            "Interfering with Platform security, attempting unauthorised access or unlawfully reverse-engineering Platform systems.",
            "Using the Platform in a way that violates applicable law or materially endangers another person.",
          ],
        },
        { kind: "clause", num: "12.1", text: "StreetdocMD may restrict, suspend or terminate access where reasonably necessary for safety, fraud prevention, non-payment, legal compliance, investigation or a material breach of these Terms. Where appropriate, we may provide notice or an opportunity to respond." },
      ],
    },
    {
      id: "complaints",
      title: "13. Complaints and Consumer Rights",
      blocks: [
        { kind: "clause", num: "13.1", text: "Contact StreetdocMD at contact@streetdocmd.com regarding Platform, payment or coordination complaints. We may request information reasonably necessary to investigate the issue." },
        { kind: "clause", num: "13.2", text: "Nothing in these Terms removes any consumer, healthcare, privacy or other statutory right that cannot lawfully be waived. You may also pursue an appropriate complaint against the responsible Provider or Facility Partner or contact the relevant regulator or consumer-protection authority." },
      ],
    },
    {
      id: "liability",
      title: "14. Liability",
      blocks: [
        { kind: "clause", num: "14.1", text: "Each party remains responsible for matters for which applicable law makes that party responsible. StreetdocMD is responsible for its own acts and omissions in operating the Platform to the extent required by law." },
        { kind: "clause", num: "14.2", text: "StreetdocMD is not responsible merely by reason of Platform facilitation for the independent clinical judgment or professional acts of a Provider, or for the independent laboratory, pharmacy, hospital, collection or delivery service of a Facility Partner, except to the extent liability arises from StreetdocMD’s own conduct or applicable law provides otherwise." },
        { kind: "clause", num: "14.3", text: "To the maximum extent permitted by law, StreetdocMD will not be liable for indirect or consequential losses that were not reasonably foreseeable from its own breach. Nothing in these Terms excludes or limits liability, remedies or consumer rights that applicable law prohibits us from excluding or limiting, including liability arising from fraud or StreetdocMD’s own negligence where such liability cannot lawfully be excluded." },
      ],
    },
    {
      id: "availability",
      title: "15. Platform Availability and Third-Party Services",
      blocks: [
        { kind: "clause", num: "15.1", text: "We aim to keep the Platform available but do not guarantee uninterrupted or error-free access. Maintenance, connectivity, power failures, payment processors, communications providers and circumstances outside our reasonable control may affect availability." },
        { kind: "clause", num: "15.2", text: "If the Platform is unavailable and you need healthcare, seek appropriate alternative care rather than relying solely on StreetdocMD." },
      ],
    },
    {
      id: "ip",
      title: "16. Intellectual Property",
      blocks: [
        { kind: "clause", num: "16.1", text: "The Platform software, design, branding and StreetdocMD-owned content are owned by or licensed to STREETDOC MD LTD. You may use them only as reasonably necessary for your personal use of the Platform and may not copy, exploit or interfere with them except as permitted by law." },
      ],
    },
    {
      id: "changes",
      title: "17. Changes to These Terms",
      blocks: [
        { kind: "clause", num: "17.1", text: "We may update these Terms to reflect service, legal or operational changes. Material changes will be communicated through the Platform or another durable electronic method. Where a material change requires fresh agreement, we will ask you to accept the updated Terms before the relevant continued use." },
      ],
    },
    {
      id: "governing-law",
      title: "18. Governing Law and Disputes",
      blocks: [
        { kind: "clause", num: "18.1", text: "These Terms are governed by the laws of the Federal Republic of Nigeria." },
        { kind: "clause", num: "18.2", text: "A dispute should first be raised with StreetdocMD for good-faith resolution. If unresolved, the parties may use mediation or another lawful dispute-resolution process. Nothing in these Terms prevents a Patient from exercising a right to approach a competent court, regulator, professional body or consumer-protection authority where applicable law permits." },
      ],
    },
    {
      id: "general",
      title: "19. General",
      blocks: [
        { kind: "clause", num: "19.1", text: "If a provision is invalid or unenforceable, it will be treated as modified or severed only to the extent necessary, without affecting the remaining provisions." },
        { kind: "clause", num: "19.2", text: "A failure or delay in enforcing a provision is not automatically a waiver. These Terms, together with incorporated Platform terms that are clearly disclosed before a transaction and the Privacy Policy on data-handling matters, form the applicable agreement concerning your use of the Platform." },
      ],
    },
    {
      id: "acceptance-record",
      title: "20. Electronic Acceptance Record",
      blocks: [
        { kind: "clause", num: "20.1", text: "No handwritten signature is required. StreetdocMD may retain an electronic record of the Terms version presented, the accepting account/user, the affirmative acceptance action, and the date/time and relevant audit information." },
      ],
    },
    {
      id: "contact",
      title: "21. Contact",
      blocks: [
        { kind: "p", text: "STREETDOC MD LTD · Registration No. 9797929" },
        { kind: "p", text: "Email: contact@streetdocmd.com" },
        { kind: "p", text: "Website: www.streetdocmd.com" },
      ],
    },
  ],
  // Clause 20: two separate unchecked boxes — terms acceptance and privacy acknowledgement
  acceptanceLabels: [
    "I confirm that I have read and agree to the StreetdocMD Patient Terms of Service.",
    "I acknowledge that I have read the StreetdocMD Privacy Policy.",
  ],
};
