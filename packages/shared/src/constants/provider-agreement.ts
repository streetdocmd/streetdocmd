// StreetdocMD Provider Service Agreement — Platform Click-to-Accept Version 2.0 (2026).
// Legal text: reproduced verbatim from STREETDOC_MD_LTD_Provider_Service_Agreement_FINAL.pdf.
// Do not reword. A material change needs a new version number, and providers must re-accept (clause 17.2).

export const PROVIDER_AGREEMENT_VERSION = "2.0";
export const PROVIDER_AGREEMENT_YEAR = "2026";

export const PROVIDER_AGREEMENT_TITLE = "Provider Service Agreement";
export const PROVIDER_AGREEMENT_SUBTITLE = "Independent Contractor Terms for Doctors, Nurses & Physiotherapists";
export const PROVIDER_AGREEMENT_PARTY_LINE =
  "STREETDOC MD LTD · Registration No. 9797929 · Platform Click-to-Accept Version 2.0 · 2026";

export const PROVIDER_AGREEMENT_INTRO =
  "This Agreement is entered into electronically between STREETDOC MD LTD (“StreetdocMD”) and the licensed healthcare professional identified during Provider registration (“Provider”). The Provider’s registration particulars, professional details and accepted commercial terms are incorporated into this Agreement.";

/** Clause 21: the checkbox label the Provider must affirmatively tick (unchecked by default). */
export const PROVIDER_AGREEMENT_ACCEPTANCE_LABEL =
  "I confirm that I am the Provider identified in this registration. I have read and agree to the StreetdocMD Provider Service Agreement, including the applicable Provider commercial terms displayed to me.";

export interface AgreementSection {
  num: number;
  title: string;
  /** numbered clauses, e.g. ["1.1", "The Provider is …"] */
  clauses: [string, string][];
  /** unnumbered bullet points (clause 10) */
  bullets?: string[];
  /** clauses printed after the bullets (clause 10.1) */
  after?: [string, string][];
}

export const PROVIDER_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    num: 1,
    title: "Parties and Nature of Relationship",
    clauses: [
      ["1.1", "The Provider is an independent, self-employed healthcare professional. Nothing in this Agreement creates an employer-employee relationship, partnership, joint venture or general agency relationship between the Provider and StreetdocMD."],
      ["1.2", "StreetdocMD operates a healthcare technology platform that connects Patients with independent healthcare professionals and provides booking, dispatch, payment, communication and clinical-documentation tools."],
      ["1.3", "StreetdocMD does not direct or supervise the Provider’s clinical judgment, diagnosis, treatment decisions or professional method of care. The Provider retains professional autonomy and remains responsible for care delivered within the Provider’s lawful scope of practice."],
      ["1.4", "The Provider may accept or decline bookings offered through the Platform and is not required to maintain minimum availability unless the Provider separately opts into a clearly disclosed programme with specific availability commitments."],
      ["1.5", "Nothing in this Agreement prevents the Provider from practising independently or through other lawful channels, subject to the confidentiality, patient-safety and non-circumvention obligations in this Agreement."],
    ],
  },
  {
    num: 2,
    title: "Eligibility, Verification and Licensing",
    clauses: [
      ["2.1", "The Provider warrants that they hold and will maintain a current, valid licence or registration required for their profession in Nigeria, including as applicable registration with the Medical and Dental Council of Nigeria (MDCN), Nursing and Midwifery Council of Nigeria (NMCN), or Medical Rehabilitation Therapists Board of Nigeria (MRTB)."],
      ["2.2", "The Provider must promptly notify StreetdocMD of any suspension, revocation, restriction, investigation, disciplinary action or other material change affecting the Provider’s authority to practise."],
      ["2.3", "StreetdocMD may verify and periodically re-verify credentials and may temporarily restrict or suspend Platform access while a material licensing or credential concern is investigated."],
      ["2.4", "False, expired, counterfeit or materially misleading credentials constitute a serious breach and may result in immediate suspension or termination and, where appropriate, referral to the relevant authority."],
    ],
  },
  {
    num: 3,
    title: "Online Onboarding and Electronic Acceptance",
    clauses: [
      ["3.1", "Before activation, the Provider must complete StreetdocMD’s onboarding requirements, which may cover Platform use, booking and dispatch, clinical documentation, safeguarding, escalation, payment and these contractual terms."],
      ["3.2", "Before registration is completed, the Provider will be presented with this Agreement and must affirmatively accept it through an unchecked checkbox, button or equivalent electronic action. Silence, inactivity or a preselected checkbox does not constitute acceptance."],
      ["3.3", "Electronic acceptance has the same contractual effect as a written acceptance to the extent permitted by applicable law. StreetdocMD may retain the Agreement version, Provider account, acceptance action, timestamp and relevant audit information."],
      ["3.4", "Onboarding is operational and does not replace the Provider’s professional regulator, professional qualification or independent clinical responsibility."],
    ],
  },
  {
    num: 4,
    title: "Equipment, Consumables and Home-Visit Readiness",
    clauses: [
      ["4.1", "The Provider is responsible, at the Provider’s own cost unless separately agreed, for equipment and consumables reasonably necessary to safely perform accepted bookings within the Provider’s profession and scope of practice."],
      ["4.2", "Equipment must be functional, hygienic, appropriately maintained and used in accordance with applicable infection-prevention, professional and safety requirements."],
      ["4.3", "StreetdocMD may publish profession-specific minimum equipment or operational checklists. Such checklists do not transfer responsibility for professional judgment or clinical readiness to StreetdocMD."],
      ["4.4", "The Provider must take reasonable precautions when attending a Patient location and must promptly use Platform safety or escalation channels where a material safety concern arises."],
    ],
  },
  {
    num: 5,
    title: "Standard of Care and Clinical Responsibility",
    clauses: [
      ["5.1", "The Provider must provide care in accordance with applicable Nigerian law, professional standards, ethical requirements, regulatory codes and the Provider’s lawful scope of practice."],
      ["5.2", "The Provider is responsible for obtaining and documenting any medical or treatment consent required for the care the Provider proposes to deliver."],
      ["5.3", "Where a Patient’s condition falls outside the Provider’s competence, scope of practice or what can safely be managed in the relevant setting, the Provider must appropriately refer, escalate or recommend transfer to a suitable healthcare facility."],
      ["5.4", "The Provider is responsible for accurate, complete and timely clinical notes, prescriptions, referrals and other professional records authored by the Provider using the Platform."],
    ],
  },
  {
    num: 6,
    title: "Professional Indemnity Insurance",
    clauses: [
      ["6.1", "The Provider must maintain professional indemnity or medical malpractice insurance where required by applicable law and, in any event, such cover as StreetdocMD reasonably requires for participation in the Provider network having regard to the Provider’s profession and scope of practice."],
      ["6.2", "The insurance requirement may be satisfied by: (a) the Provider’s own valid policy; or (b) an eligible group, scheme or other approved professional indemnity arrangement made available or recognised by StreetdocMD, provided the applicable cover is in force."],
      ["6.3", "The Provider must provide evidence of applicable cover when reasonably requested and must notify StreetdocMD of cancellation, lapse or a material restriction in cover."],
      ["6.4", "StreetdocMD may suspend new bookings while required insurance is not in force. Participation in a StreetdocMD-facilitated insurance arrangement does not make StreetdocMD the Provider’s employer or insurer."],
    ],
  },
  {
    num: 7,
    title: "Provider Pricing",
    clauses: [
      ["7.1", "The Provider may select the Provider’s consultation or service price (“Provider Price”) within the price band made available by StreetdocMD for the relevant profession, service type, location or booking category."],
      ["7.2", "StreetdocMD may establish and revise reasonable minimum and maximum price bands to support a clear and workable marketplace. The applicable band will be displayed through the Platform before the Provider sets or changes a Provider Price."],
      ["7.3", "A Provider Price change applies prospectively. It does not retrospectively alter the price of a booking already accepted or paid."],
      ["7.4", "StreetdocMD may offer optional promotional or special programmes with separate pricing terms. Participation in such a programme must be disclosed to and accepted by the Provider before those programme terms apply."],
      ["7.5", "The Provider remains responsible for any tax obligations applicable to income earned through the Platform."],
    ],
  },
  {
    num: 8,
    title: "Commission, Payment and Settlement",
    clauses: [
      ["8.1", "StreetdocMD earns a commission on completed Provider bookings. The permitted commission range under this Agreement is fifteen percent (15%) to thirty percent (30%) of the applicable Provider Price."],
      ["8.2", "Unless a different rate has been expressly assigned and displayed to the Provider, the standard commission rate is twenty percent (20%)."],
      ["8.3", "A Provider’s applicable rate may differ within the 15%–30% range based on clearly communicated commercial arrangements, which may include booking source, programme participation, acquisition or coordination requirements, volume, reliability, promotional arrangements or other legitimate Platform commercial factors."],
      ["8.4", "The applicable commission rate must be visible to the Provider through the Platform or applicable commercial schedule before it is applied. StreetdocMD will not retrospectively increase the commission on a booking already accepted under a lower rate."],
      ["8.5", "StreetdocMD may revise a Provider’s future commission rate within the contractual range by giving at least fourteen (14) days’ prior electronic notice, unless the Provider affirmatively agrees to an earlier change. A change outside the 15%–30% range requires an amendment or fresh acceptance."],
      ["8.6", "Patient payments may be processed through Paystack or a replacement payment processor. After a completed booking, the Provider is entitled to the Provider Price less the applicable StreetdocMD commission and any other deduction that was expressly disclosed and accepted under the applicable Platform commercial terms, subject to refunds, reversals, chargebacks, fraud/security review and payment-processor or banking constraints."],
      ["8.7", "StreetdocMD will maintain a transaction record showing, as applicable, the Provider Price, commission rate, commission amount, Provider net amount, refund/reversal adjustment and settlement status."],
      ["8.8", "StreetdocMD may temporarily hold or reverse an amount reasonably connected to a disputed, cancelled, fraudulent, duplicated or uncompleted transaction while the matter is reviewed. The Provider will be given reasonable transaction information and an opportunity to respond where appropriate."],
      ["8.9", "The Provider may not impose an undisclosed additional charge on a Patient for a booking that has already been confirmed through the Platform."],
    ],
  },
  {
    num: 9,
    title: "Patient Complaints, Refunds and Clinical Disputes",
    clauses: [
      ["9.1", "StreetdocMD may receive, log and facilitate communication of Patient complaints and may review relevant Platform records. StreetdocMD does not replace the Provider’s regulator, a competent court or other lawful dispute-resolution body."],
      ["9.2", "The Provider must cooperate promptly and in good faith with a reasonable complaint or safety review, including by preserving and providing relevant Platform clinical documentation where lawfully required."],
      ["9.3", "A complaint about clinical quality does not automatically establish negligence or automatically require a refund. Payment adjustments will be handled according to the circumstances, applicable Platform refund terms, payment-network rules and applicable law."],
      ["9.4", "Serious allegations involving patient harm, abuse, fraud, gross professional misconduct or safeguarding may justify immediate temporary suspension pending investigation and may be reported where StreetdocMD is legally required or reasonably entitled to do so."],
    ],
  },
  {
    num: 10,
    title: "Code of Conduct and Non-Circumvention",
    clauses: [],
    bullets: [
      "Attend accepted bookings punctually or give timely notice through the Platform if unable to attend.",
      "Treat Patients, families, Facility Partner personnel and StreetdocMD personnel professionally and respectfully.",
      "Do not solicit a Patient first introduced through StreetdocMD to move a Platform-booked service off-platform for the purpose of avoiding the applicable StreetdocMD commission.",
      "Do not accept direct cash or off-platform payment for a service that the Platform identifies as requiring Platform payment, except through a payment method expressly approved by StreetdocMD.",
      "Maintain accurate and timely clinical documentation for each completed booking.",
      "Do not share account credentials or permit another person to deliver care under the Provider’s verified identity.",
    ],
    after: [
      ["10.1", "Deliberate circumvention intended to avoid an applicable commission or defeat a confirmed Platform transaction is a material breach. This clause does not prevent the Provider from maintaining a genuinely independent practice or treating a person through a relationship that was not improperly diverted from StreetdocMD."],
    ],
  },
  {
    num: 11,
    title: "Data Protection and Confidentiality",
    clauses: [
      ["11.1", "The Provider will process personal and health information only as lawfully necessary for care, Platform operations, professional record-keeping and other permitted purposes, in accordance with the Nigeria Data Protection Act 2023, applicable regulatory requirements and the StreetdocMD Privacy Policy."],
      ["11.2", "The parties acknowledge that data-protection roles depend on the processing activity. StreetdocMD may act as controller or processor for Platform activities, while the Provider may have independent controller and professional record-keeping responsibilities for clinical care. Nothing in this Agreement automatically characterises every Provider processing activity as processing solely on StreetdocMD’s behalf."],
      ["11.3", "The Provider must maintain appropriate confidentiality and security, must not use Patient information for unrelated marketing or personal purposes without a lawful basis, and must promptly report a suspected material privacy or security incident affecting Platform Patient data."],
      ["11.4", "Confidentiality and lawful record-handling obligations survive termination for as long as required by applicable law, professional duties or the nature of the information."],
    ],
  },
  {
    num: 12,
    title: "Safeguarding and Escalation",
    clauses: [
      ["12.1", "The Provider must respond appropriately to safeguarding concerns identified during care, including suspected abuse, neglect or risk to a vulnerable person, in accordance with professional and legal obligations."],
      ["12.2", "Where appropriate and lawful, the Provider must use StreetdocMD’s safeguarding or escalation mechanism so that relevant Platform action can be taken."],
      ["12.3", "A serious failure to respond to a safeguarding concern may result in suspension or termination independently of any regulatory consequence."],
    ],
  },
  {
    num: 13,
    title: "Indemnities and Allocation of Responsibility",
    clauses: [
      ["13.1", "Subject to applicable law, the Provider will indemnify STREETDOC MD LTD and its directors, officers, employees and agents against third-party claims, losses and reasonable costs to the extent arising from the Provider’s professional negligence or malpractice, breach of professional or regulatory duty, fraud, wilful misconduct, or material breach of this Agreement."],
      ["13.2", "StreetdocMD will be responsible for claims to the extent directly arising from StreetdocMD’s own proven breach, negligence, wilful misconduct or material Platform failure for which StreetdocMD is legally responsible."],
      ["13.3", "Neither party is required to indemnify the other to the extent a loss was caused by the other party’s own negligence, wilful misconduct or breach."],
      ["13.4", "Nothing in this Agreement transfers the Provider’s responsibility for diagnosis, treatment, prescription, clinical judgment or professional conduct to StreetdocMD."],
    ],
  },
  {
    num: 14,
    title: "Limitation of Liability",
    clauses: [
      ["14.1", "To the maximum extent permitted by law, neither party will be liable to the other for indirect or consequential loss that was not reasonably foreseeable from that party’s breach."],
      ["14.2", "Subject to Clause 14.3, StreetdocMD’s aggregate contractual liability to the Provider arising from this Agreement will not exceed the total commission actually retained by StreetdocMD from that Provider’s completed bookings during the twelve (12) months immediately preceding the event giving rise to the claim."],
      ["14.3", "The limitation in Clause 14.2 does not apply to fraud, wilful misconduct, or any liability that applicable law does not permit to be excluded or limited."],
    ],
  },
  {
    num: 15,
    title: "Suspension and Termination",
    clauses: [
      ["15.1", "StreetdocMD may immediately suspend or restrict a Provider’s account where reasonably necessary because of a patient-safety concern, licence or credential issue, required insurance lapse, serious complaint, suspected fraud, data-security concern or material breach, pending review."],
      ["15.2", "Either party may terminate this Agreement for convenience on fourteen (14) days’ written or electronic notice."],
      ["15.3", "StreetdocMD may terminate immediately for loss or suspension of required professional authority, fraudulent credentials, serious or repeated breach, conduct materially endangering Patient safety, deliberate Platform circumvention, or other conduct making continued access unlawful or unsafe."],
      ["15.4", "Termination does not affect accrued rights or obligations, including settlement for properly completed bookings, valid refunds/reversals, confidentiality, clinical record obligations, indemnities or dispute provisions intended to survive."],
    ],
  },
  {
    num: 16,
    title: "Platform Availability, Branding and Intellectual Property",
    clauses: [
      ["16.1", "StreetdocMD may maintain, update or temporarily interrupt Platform services and does not guarantee uninterrupted availability."],
      ["16.2", "The Provider receives a limited, revocable, non-transferable right to use the Platform for authorised Provider activities. StreetdocMD software, branding and Platform materials remain owned by or licensed to STREETDOC MD LTD."],
      ["16.3", "The Provider may accurately describe participation in the StreetdocMD network but may not represent that the Provider is an employee, subsidiary, exclusive agent or owner of StreetdocMD, or use StreetdocMD branding beyond authorised use."],
    ],
  },
  {
    num: 17,
    title: "Changes to Commercial Terms and Agreement",
    clauses: [
      ["17.1", "Non-material operational policies may be updated through the Platform where reasonably necessary."],
      ["17.2", "Material amendments to this Agreement will be communicated through the Platform or another durable electronic method. Where a material amendment requires fresh agreement, StreetdocMD may require affirmative re-acceptance before continued participation."],
      ["17.3", "Commission-rate changes are additionally governed by Clause 8.5."],
    ],
  },
  {
    num: 18,
    title: "Dispute Resolution and Governing Law",
    clauses: [
      ["18.1", "This Agreement is governed by the laws of the Federal Republic of Nigeria."],
      ["18.2", "A dispute between StreetdocMD and the Provider should first be addressed through good-faith negotiation. If unresolved within thirty (30) days, either party may propose mediation."],
      ["18.3", "If the parties agree to arbitrate an unresolved commercial dispute, the arbitration will be conducted in accordance with the Arbitration and Mediation Act 2023, by a single arbitrator, in English, with the seat in Ibadan, Oyo State, unless the parties agree otherwise."],
      ["18.4", "Nothing in this clause prevents either party from seeking urgent interim relief from a competent court or exercising a right or remedy that applicable law does not permit the parties to exclude."],
    ],
  },
  {
    num: 19,
    title: "Notices and Contact",
    clauses: [
      ["19.1", "Notices may be delivered through the Provider’s registered Platform account, registered email address or another durable electronic method associated with the Provider’s account."],
      ["19.2", "Notices to StreetdocMD may be sent to contact@streetdocmd.com. The Platform website is www.streetdocmd.com."],
      ["19.3", "The Provider must keep account, contact, payout, licensing and other onboarding information current."],
    ],
  },
  {
    num: 20,
    title: "General Provisions",
    clauses: [
      ["20.1", "This Agreement, the accepted Provider commercial terms, the StreetdocMD Privacy Policy and any expressly incorporated schedules constitute the agreement between the parties concerning the Provider’s Platform participation."],
      ["20.2", "If a provision is invalid or unenforceable, it will be modified or severed only to the extent necessary and the remaining provisions will continue in effect."],
      ["20.3", "A delay or failure to enforce a right is not automatically a waiver."],
      ["20.4", "The Provider may not transfer the Provider account or assign this Agreement in a manner that permits another person to practise under the Provider’s verified identity. StreetdocMD may assign this Agreement as part of a lawful corporate restructuring, financing, merger, acquisition or transfer of the Platform business, subject to applicable law."],
    ],
  },
];

/** Schedule 1. Provider Commercial Framework */
export const PROVIDER_AGREEMENT_SCHEDULE_1: [string, string][] = [
  ["Provider Price", "Selected by Provider within the StreetdocMD price band applicable to the service/category."],
  ["Permitted commission range", "15%–30% of Provider Price."],
  ["Standard/default commission", "20%, unless another rate is expressly assigned and displayed."],
  ["Rate visibility", "Applicable rate must be displayed through the Platform or accepted commercial schedule before application."],
  ["Rate changes", "At least 14 days’ prior notice for future changes within the 15%–30% range, unless earlier change is affirmatively agreed."],
  ["Settlement", "Provider Price less applicable commission and any other expressly disclosed and accepted adjustment, subject to valid refunds, reversals, chargebacks and payment-processing constraints."],
  ["Retrospective changes", "No retrospective increase to Provider Price commission for an already accepted booking."],
];

/** Schedule 2. Professional and Operational Particulars */
export const PROVIDER_AGREEMENT_SCHEDULE_2 =
  "The Provider’s profession, licence/registration details, approved service categories, service area, price selections, payout details, insurance evidence (where applicable), and other onboarding particulars are maintained through the Provider account and incorporated into this Agreement as updated from time to time in accordance with the Agreement.";
