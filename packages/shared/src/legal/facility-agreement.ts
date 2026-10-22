import type { LegalDocument } from "./types";

// StreetdocMD Facility Partner Platform Service Agreement — Production Draft v2 · 2026
// (Platform Click-to-Accept Version). Reproduced verbatim from the approved document.
// Do not reword; a material amendment needs a new version and may require re-acceptance (21.3).

export const FACILITY_AGREEMENT: LegalDocument = {
  slug: "facility-agreement",
  title: "Facility Partner Platform Service Agreement",
  subtitle: "Online Terms for Laboratory, Pharmacy and Hospital Facility Partners",
  version: "2",
  versionLabel: "Production Draft v2 · 2026",
  partyLine: "Platform terms between STREETDOC MD LTD and each Facility Partner that accepts these terms during sign-up · Platform Click-to-Accept Version · 2026",
  intro: [
    { kind: "p", text: "Applicable to Facility Partners signing up as a Laboratory, Pharmacy or Hospital. Designed for electronic acceptance during Facility Partner onboarding. The Facility Partner's sign-up information and electronic acceptance record form part of this Agreement." },
    { kind: "p", text: "This Facility Partner Platform Service Agreement (the “Agreement”) is an electronic contract between STREETDOC MD LTD, a company incorporated under the laws of the Federal Republic of Nigeria with Registration No. 9797929 (“StreetdocMD”), and the laboratory, pharmacy or hospital business identified in the Facility Partner sign-up form (the “Facility”)." },
    { kind: "p", text: "The Facility’s legal name, RC/BN number, Facility Type, address, approved service premises, regulatory licence details, contact details and authorised representative are the particulars submitted by the Facility during sign-up and are incorporated into this Agreement." },
    { kind: "p", text: "StreetdocMD and the Facility are each a “Party” and together the “Parties”. This Agreement becomes binding when an authorised representative of the Facility affirmatively accepts it during sign-up in accordance with Clause 2." },
  ],
  sections: [
    {
      id: "recitals",
      title: "Recitals",
      blocks: [
        {
          kind: "bullets",
          items: [
            "StreetdocMD operates a health-technology platform that facilitates patient access to independent healthcare professionals and independent laboratory, pharmacy and hospital facilities.",
            "The Facility is independently owned, operated and managed, and wishes to receive referrals and/or orders through the StreetdocMD platform.",
            "The Parties wish to set out the terms governing referrals, service delivery, payment facilitation, data handling and use of the platform.",
          ],
        },
      ],
    },
    {
      id: "definitions",
      title: "1. Definitions and Interpretation",
      blocks: [
        { kind: "clause", num: "1.1", text: "“Applicable Law” means all Nigerian laws, regulations, professional rules, regulatory directives and binding standards applicable to a Party, the Platform, the Facility or the Services." },
        { kind: "clause", num: "1.2", text: "“Facility Type” means the category selected by the Facility on execution of this Agreement: Laboratory, Pharmacy or Hospital." },
        { kind: "clause", num: "1.3", text: "“Ancillary Service Fee” means a home sample-collection, delivery, dispatch or similar operational fee set by the Facility and disclosed to the Patient through the Platform." },
        { kind: "clause", num: "1.4", text: "“Patient” means a person whose order, prescription, referral or healthcare request is transmitted to the Facility through the Platform." },
        { kind: "clause", num: "1.5", text: "“Platform” means StreetdocMD’s website at www.streetdocmd.com, applications, portals, communications channels and related technology used to facilitate bookings, referrals, payments and records." },
        { kind: "clause", num: "1.6", text: "“Services” means the laboratory, pharmacy, hospital or related services that the Facility is lawfully authorised to provide and that are accepted by the Facility through the Platform." },
        { kind: "clause", num: "1.7", text: "“Patient Service Fee” means any separate platform, convenience or service fee that StreetdocMD may charge a Patient for use of the Platform. A Patient Service Fee is separate from the Facility Price and does not reduce the Facility Price." },
        { kind: "clause", num: "1.8", text: "Headings are for convenience only. References to legislation include amendments and re-enactments. “Including” means including without limitation." },
      ],
    },
    {
      id: "sign-up",
      title: "2. Online Sign-Up and Electronic Acceptance",
      blocks: [
        { kind: "clause", num: "2.1", text: "To apply to join the Platform, the Facility shall create a Facility Partner account and provide the onboarding information and documents requested by StreetdocMD." },
        { kind: "clause", num: "2.2", text: "Before sign-up can be completed, the Facility’s authorised representative must be given access to this Agreement and must affirmatively indicate acceptance by selecting the checkbox or button presented with words substantially similar to: “I have read and agree to the StreetdocMD Facility Partner Platform Service Agreement.”" },
        { kind: "clause", num: "2.3", text: "The Facility may not complete registration or activate its Facility Partner account unless the acceptance control is affirmatively selected. A pre-selected checkbox, silence or inactivity shall not constitute acceptance." },
        { kind: "clause", num: "2.4", text: "By accepting this Agreement, the individual completing sign-up represents and warrants that he or she has authority to bind the Facility. If that individual lacks authority, the Facility must not complete sign-up." },
        { kind: "clause", num: "2.5", text: "The Facility agrees that its electronic acceptance has the same contractual effect as signing a written copy. StreetdocMD may retain an electronic record of acceptance, including the Agreement version, Facility account, accepting user, date and time of acceptance and other reasonable audit information." },
        { kind: "clause", num: "2.6", text: "The effective date is the date and time on which the Facility validly accepts this Agreement during sign-up (the “Effective Date”). Account activation may remain subject to StreetdocMD’s verification of licences, approvals, insurance, banking details and other onboarding requirements." },
        { kind: "clause", num: "2.7", text: "The Facility shall keep its onboarding information accurate and current and shall update or notify StreetdocMD of any material change to its legal name, ownership, Facility Type, approved premises, licence status, contact details or settlement details." },
        { kind: "clause", num: "2.8", text: "The version of this Agreement displayed or linked at the point of acceptance, together with the Facility’s accepted commercial terms and incorporated schedules, constitutes the contract accepted by the Facility. StreetdocMD shall make the accepted terms reasonably accessible after sign-up." },
      ],
    },
    {
      id: "relationship",
      title: "3. Nature of Relationship",
      blocks: [
        { kind: "clause", num: "3.1", text: "The Facility is an independent business, wholly owned, operated and managed separately from StreetdocMD. Nothing in this Agreement creates an employment, partnership, joint venture, franchise, subsidiary, fiduciary or agency relationship between the Parties." },
        { kind: "clause", num: "3.2", text: "StreetdocMD is a technology and facilitation platform. It does not own, operate or clinically supervise the Facility and does not direct the Facility’s clinical, laboratory, pharmaceutical or hospital judgment." },
        { kind: "clause", num: "3.3", text: "The Facility has no authority to bind StreetdocMD, incur liability on StreetdocMD’s behalf, make representations on StreetdocMD’s behalf, or hold itself out as StreetdocMD’s agent." },
        { kind: "clause", num: "3.4", text: "This Agreement is non-exclusive. The Facility may receive business from other sources, and StreetdocMD may engage or refer Patients to other facilities, including facilities of the same type or in the same operating area." },
        { kind: "clause", num: "3.5", text: "Nothing in this Agreement creates a guaranteed minimum number or value of referrals, a right of first refusal, or territorial exclusivity." },
      ],
    },
    {
      id: "eligibility",
      title: "4. Eligibility, Registration and Regulatory Compliance",
      blocks: [
        { kind: "clause", num: "4.1", text: "The Facility warrants throughout the Term that it is duly registered and has every licence, registration, approval, accreditation, permit and regulatory authorisation required to operate its Facility Type and provide the Services from the premises or locations used." },
        { kind: "clause", num: "4.2", text: "Without limiting Clause 4.1, the Facility shall maintain all applicable registrations and approvals, including those issued by the relevant professional, facility, medicines, laboratory and health authorities." },
        {
          kind: "table",
          headers: ["Facility Type", "Core Regulatory Requirement", "Operational Requirement"],
          rows: [
            ["Laboratory", "Applicable Medical Laboratory Science Council of Nigeria registration/licensing and other required approvals.", "Valid equipment calibration, quality-control and premises records."],
            ["Pharmacy", "Applicable Pharmacy Council of Nigeria premises and superintendent pharmacist registration/licensing.", "Lawful and traceable sourcing; compliance with applicable NAFDAC and medicines requirements."],
            ["Hospital", "Applicable State Ministry of Health/facility approvals and professional licences for relevant staff.", "Current facility inspection/renewal status and lawful staffing."],
          ],
        },
        { kind: "clause", num: "4.3", text: "The Facility shall provide documentary evidence of its registrations, licences, approvals and insurance before activation and upon reasonable request or renewal." },
        { kind: "clause", num: "4.4", text: "The Facility shall notify StreetdocMD in writing within forty-eight (48) hours after becoming aware of any suspension, revocation, restriction, investigation, disciplinary action or other material regulatory issue affecting the Facility, its premises or personnel." },
        { kind: "clause", num: "4.5", text: "StreetdocMD may independently verify and periodically re-verify the Facility’s regulatory status and may suspend the Facility pending clarification of a material concern." },
        { kind: "clause", num: "4.6", text: "The Facility shall not provide Services through the Platform from an unlicensed, unregistered or unauthorised branch, premises or location." },
        { kind: "clause", num: "4.7", text: "All personnel engaged by the Facility in providing Services must hold current licences, registrations or authorisations appropriate to their roles. The Facility remains responsible for its personnel and subcontractors." },
      ],
    },
    {
      id: "services",
      title: "5. Scope and Standard of Services",
      blocks: [
        { kind: "clause", num: "5.1", text: "The Facility shall provide only Services that fall within its lawful scope, Facility Type and accepted Platform listing." },
        { kind: "clause", num: "5.2", text: "A Laboratory shall: (a) receive investigation orders through the Platform; (b) perform requested tests to applicable professional standards; (c) where home sample collection is offered, arrange and remain responsible for the phlebotomist or other qualified sample-collection personnel; (d) ensure such personnel are appropriately qualified, identified and equipped and comply with applicable infection-control, sample-handling, transport and professional requirements; (e) clearly state any home sample-collection fee to the Patient through the Platform before payment; and (f) provide accurate results, reference ranges and clinically appropriate flags within its stated turnaround time." },
        { kind: "clause", num: "5.3", text: "A Pharmacy shall: (a) receive prescription orders through the Platform; (b) confirm price and stock availability; (c) dispense only genuine, in-date and lawfully sourced medicines matching a valid prescription; (d) where delivery is offered, arrange and remain responsible for its dispatch rider, courier or delivery provider and clearly state any delivery fee to the Patient through the Platform before payment; (e) take reasonable measures to ensure medicines are securely and appropriately handled during delivery; and (f) escalate prescription concerns to the prescribing Provider before dispensing." },
        { kind: "clause", num: "5.4", text: "A Hospital shall: (a) receive referrals through the Platform; (b) provide accurate information on relevant service or bed availability when acknowledging a referral; (c) independently admit, treat, refer or otherwise manage the Patient in accordance with Applicable Law and its clinical standards; and (d) provide an appropriate discharge or outcome summary to the referring Provider through the Platform where lawful and practicable." },
        { kind: "clause", num: "5.5", text: "StreetdocMD may publish reasonable operational and service-level requirements for Platform participation, provided they do not direct the Facility’s independent clinical judgment. Material service levels and pricing shall be stated in Schedule 2 or another written schedule agreed or accepted under this Agreement." },
        { kind: "clause", num: "5.6", text: "Unless StreetdocMD expressly agrees otherwise in writing, each Facility bears its own operational costs in providing the Services, including the cost of phlebotomists, sample-collection personnel, dispatch riders, couriers and other Facility personnel or contractors. The Facility may charge the Patient a separate home collection or delivery fee, provided that the fee is clearly disclosed through the Platform before the Patient confirms and pays for the transaction. StreetdocMD is not the employer, principal or logistics provider of such personnel merely because the booking, payment or communication is facilitated through the Platform." },
      ],
    },
    {
      id: "responsibility",
      title: "6. Independent Professional and Business Responsibility",
      blocks: [
        { kind: "clause", num: "6.1", text: "The Facility is solely responsible for the accuracy, quality, safety and legality of the Services it provides, including laboratory results, medicines dispensed and hospital care." },
        { kind: "clause", num: "6.2", text: "StreetdocMD’s role is limited to technology, referral, communication and payment facilitation. StreetdocMD does not review, verify or certify the clinical or technical accuracy of a result, medicine dispensed or treatment provided by the Facility." },
        { kind: "clause", num: "6.3", text: "The Facility shall obtain all clinical or treatment consents that Applicable Law or professional standards require from the Patient or lawful representative before carrying out the relevant Service." },
        { kind: "clause", num: "6.4", text: "Patient complaints relating to the Facility’s clinical or professional Services remain the Facility’s responsibility, without prejudice to StreetdocMD’s rights to facilitate communication, investigate Platform issues, suspend access, preserve records or make lawful regulatory reports." },
      ],
    },
    {
      id: "data-protection",
      title: "7. Data Protection and Confidentiality",
      blocks: [
        { kind: "clause", num: "7.1", text: "Each Party shall comply with the Nigeria Data Protection Act 2023 (“NDPA”), applicable regulations and lawful guidance of the Nigeria Data Protection Commission, and shall implement appropriate technical and organisational measures for personal data within its control." },
        { kind: "clause", num: "7.2", text: "The Parties acknowledge that their data-protection roles depend on the relevant processing activity and are not determined solely by the label used in this Agreement." },
        { kind: "clause", num: "7.3", text: "Where the Facility processes personal data solely on StreetdocMD’s documented instructions for Platform administration, referral transmission or another activity for which StreetdocMD determines the purposes and means, the Facility shall act as StreetdocMD’s data processor and shall: (a) process only on documented instructions; (b) ensure authorised persons are bound by confidentiality; (c) implement appropriate security measures; (d) assist StreetdocMD with data-subject requests, security, breach response and compliance information; (e) not appoint a sub-processor for that processing without prior written authorisation or an agreed notification mechanism; and (f) on termination, return or securely delete such data unless retention is required by law." },
        { kind: "clause", num: "7.4", text: "Where the Facility independently determines the purposes and means of processing in connection with its healthcare, laboratory, pharmacy or hospital services, clinical records, regulatory compliance, complaint handling, legal claims or professional obligations, the Facility acts as an independent data controller and is independently responsible for the lawfulness, transparency, security, retention and other requirements applicable to that processing." },
        { kind: "clause", num: "7.5", text: "The Facility shall use Patient data received through the Platform only for the referred Service, continuity of care, lawful recordkeeping, regulatory compliance, legal claims or another lawful and transparent purpose. It shall not use such data for unrelated marketing without a valid lawful basis and any consent required by law." },
        { kind: "clause", num: "7.6", text: "The Facility shall notify StreetdocMD without undue delay and, in any event, within twenty-four (24) hours after becoming aware of an actual or reasonably suspected personal-data breach affecting Platform-referred Patient data. The initial notice shall, so far as known, describe the nature of the incident, affected data and persons, likely consequences, containment steps and a responsible contact." },
        { kind: "clause", num: "7.7", text: "The Facility shall cooperate with StreetdocMD’s reasonable investigation and mitigation requests. Neither Party shall purport to notify a regulator or Patient on behalf of the other without authority, except where independently required by Applicable Law." },
        { kind: "clause", num: "7.8", text: "Where data concerns a child or a person lacking legal capacity, each Party shall ensure that its own processing has a lawful basis and that required parental, guardian or representative authority is obtained or another lawful exception applies." },
        { kind: "clause", num: "7.9", text: "The Facility may retain its own clinical and statutory records for the period required or permitted by Applicable Law and professional obligations. Data held solely as StreetdocMD’s processor shall be retained only for the instructed or legally required period." },
        { kind: "clause", num: "7.10", text: "Each Party shall keep confidential all non-public business, technical, security, commercial and Patient information received from the other and shall disclose it only as permitted by this Agreement or required by law. These confidentiality obligations survive termination." },
      ],
    },
    {
      id: "pricing-payments",
      title: "8. Facility Pricing, Payments, Withdrawals, Refunds and Taxes",
      blocks: [
        { kind: "clause", num: "8.1", text: "The Facility independently sets the price it charges for its Services (the “Facility Price”). StreetdocMD does not deduct a percentage commission or referral fee from the Facility Price. StreetdocMD may collect Patient payments through Paystack or another notified payment processor and credit the applicable Facility Price to the Facility’s Platform balance." },
        { kind: "clause", num: "8.2", text: "The Facility shall keep its Facility Prices, Ancillary Service Fees, stock, service availability and other commercial information accurate and current on the Platform. The Facility may change its prices and Ancillary Service Fees prospectively, but an amount already confirmed and paid by a Patient for a transaction may not be increased retrospectively." },
        { kind: "clause", num: "8.3", text: "The Facility may initiate withdrawal of its available Platform balance at any time permitted by the Platform. Actual receipt remains subject to Paystack and banking processing times, security or fraud checks, chargebacks, technical availability and Applicable Law." },
        { kind: "clause", num: "8.4", text: "The Facility shall bear the applicable payment-processing charges imposed by Paystack or any replacement payment processor in respect of payments collected for the Facility. Such charges may be deducted from the Facility’s Platform balance before withdrawal. StreetdocMD does not add any commission or percentage charge to the Facility Price." },
        { kind: "clause", num: "8.5", text: "StreetdocMD may automatically cancel, reverse, debit or refund a transaction where the Service was cancelled or clearly not delivered, a payment was duplicated or made in error, fraud is reasonably suspected or established, or a payment processor or financial institution imposes a chargeback or reversal. StreetdocMD shall provide reasonable transaction information to the Facility." },
        { kind: "clause", num: "8.6", text: "A complaint concerning the quality, adequacy or clinical outcome of a Service shall not, by itself, result in an automatic deduction from the Facility’s balance. StreetdocMD may temporarily hold the disputed amount where reasonably necessary and shall review the relevant records and give the Facility a reasonable opportunity to respond before deciding whether a refund or adjustment is appropriate, subject to mandatory law and payment-network rules." },
        { kind: "clause", num: "8.7", text: "StreetdocMD may charge the Patient a separate Patient Service Fee for access to or use of the Platform. The Patient Service Fee is StreetdocMD’s revenue, is separate from the Facility Price, and shall not reduce the Facility Price credited to the Facility. StreetdocMD determines and discloses the applicable Patient Service Fee to the Patient." },
        { kind: "clause", num: "8.8", text: "Each Party is responsible for its own taxes, levies and statutory obligations. StreetdocMD may make any deduction or withholding required by law and shall provide available evidence of the deduction where applicable." },
      ],
    },
    {
      id: "insurance",
      title: "9. Insurance",
      blocks: [
        { kind: "clause", num: "9.1", text: "The Facility shall maintain professional indemnity insurance from a registered insurer as required by Applicable Law and shall maintain such public liability, product liability or other insurance as is reasonably appropriate to its Facility Type, Services and scale of operation." },
        { kind: "clause", num: "9.2", text: "The Facility shall provide evidence of current insurance before activation and upon renewal or reasonable request, and shall promptly notify StreetdocMD of cancellation, lapse or a material reduction in required cover." },
        { kind: "clause", num: "9.3", text: "A failure to maintain required insurance is grounds for immediate suspension until satisfactory cover is restored." },
      ],
    },
    {
      id: "indemnities",
      title: "10. Indemnities",
      blocks: [
        { kind: "clause", num: "10.1", text: "Subject to Applicable Law, the Facility shall indemnify StreetdocMD, its officers, employees and agents against third-party claims, losses, liabilities, damages and reasonable legal costs to the extent arising from: (a) the Facility’s negligence, malpractice, professional misconduct, error or omission; (b) inaccurate results, unsafe or counterfeit products, unlawful dispensing or deficient Services; (c) breach of licensing, regulatory, data-protection, confidentiality or other obligations under this Agreement; (d) acts or omissions of Facility personnel or subcontractors; (e) infringement by materials supplied by the Facility of third-party intellectual-property rights; or (f) taxes or employment liabilities attributable to the Facility." },
        { kind: "clause", num: "10.2", text: "StreetdocMD shall indemnify the Facility against third-party claims to the extent arising directly and solely from a demonstrable defect or error in the Platform itself, including a verified referral misrouting or payment-processing error caused by StreetdocMD, except to the extent the Facility contributed to the loss." },
        { kind: "clause", num: "10.3", text: "The indemnified Party shall give reasonably prompt notice of a claim, permit the indemnifying Party to participate in the defence, and provide reasonable cooperation. No settlement admitting fault or imposing non-monetary obligations on the indemnified Party may be entered without its consent, not to be unreasonably withheld." },
      ],
    },
    {
      id: "liability",
      title: "11. Limitation of Liability",
      blocks: [
        { kind: "clause", num: "11.1", text: "Nothing in this Agreement excludes or limits liability that cannot lawfully be excluded or limited." },
        { kind: "clause", num: "11.2", text: "Subject to Clause 11.1 and to the maximum extent permitted by law, StreetdocMD’s aggregate contractual liability to the Facility arising from this Agreement shall not exceed the total Patient Service Fee retained by StreetdocMD from the Facility’s referrals during the twelve (12) months immediately preceding the event giving rise to the claim." },
        { kind: "clause", num: "11.3", text: "The limitation in Clause 11.2 does not apply to StreetdocMD’s fraud, wilful misconduct or gross negligence, or to payment obligations that are properly due and undisputed." },
        { kind: "clause", num: "11.4", text: "StreetdocMD is not responsible for the independent clinical, laboratory, pharmaceutical or hospital acts or omissions of the Facility, except to the extent liability arises from StreetdocMD’s own conduct and cannot lawfully be excluded." },
      ],
    },
    {
      id: "complaints",
      title: "12. Patient Complaints, Investigations and Regulatory Cooperation",
      blocks: [
        { kind: "clause", num: "12.1", text: "StreetdocMD may receive, log and facilitate communication of a Patient complaint concerning the Facility and may review relevant Platform records." },
        { kind: "clause", num: "12.2", text: "The Facility shall cooperate promptly and in good faith with reasonable requests concerning a complaint, safeguarding issue, payment dispute or Platform investigation, subject to Patient confidentiality and Applicable Law." },
        { kind: "clause", num: "12.3", text: "Serious allegations, including patient harm, counterfeit products, fraud, gross negligence, safeguarding concerns or regulatory breaches, may result in immediate suspension pending investigation and may be reported to an appropriate regulator or law-enforcement authority where lawful or required." },
      ],
    },
    {
      id: "non-circumvention",
      title: "13. Non-Circumvention",
      blocks: [
        { kind: "clause", num: "13.1", text: "For twelve (12) months after a Patient is first introduced to the Facility through the Platform, the Facility shall not knowingly solicit that Patient to book or pay outside the Platform for substantially similar Services ordinarily available through the Platform where the purpose or effect is to avoid the Patient Service Fee." },
        { kind: "clause", num: "13.2", text: "Clause 13.1 does not prohibit treatment required for patient safety, a service not offered through the Platform, or a demonstrable pre-existing direct relationship between the Facility and the Patient that existed before the StreetdocMD referral." },
        { kind: "clause", num: "13.3", text: "Deliberate circumvention in breach of this Clause is a material breach and may result in suspension or termination." },
      ],
    },
    {
      id: "branding-ip",
      title: "14. Branding, Intellectual Property and Platform Use",
      blocks: [
        { kind: "clause", num: "14.1", text: "Subject to StreetdocMD’s written brand guidelines, the Facility may describe itself as a “StreetdocMD Partner Facility” during the Term, but shall not represent that it is owned by, a subsidiary of, an agent of, or an exclusive partner of StreetdocMD." },
        { kind: "clause", num: "14.2", text: "StreetdocMD and its licensors retain all rights in the Platform, software, databases, designs, trade marks, logos, documentation and related intellectual property. No ownership right is transferred to the Facility." },
        { kind: "clause", num: "14.3", text: "Each Party grants the other a limited, non-exclusive, revocable licence during the Term to use its name and approved marks solely as reasonably necessary to perform this Agreement, subject to any written brand restrictions." },
        { kind: "clause", num: "14.4", text: "The Facility shall not reverse-engineer, scrape, probe, copy, interfere with, bypass security of, or gain unauthorised access to the Platform, except to the extent a restriction is prohibited by law." },
        { kind: "clause", num: "14.5", text: "The Facility retains responsibility for and rights in content, results and records it creates, subject to the licences and data-processing permissions reasonably necessary for StreetdocMD to operate the Platform, fulfil Patient requests, maintain records and comply with law." },
      ],
    },
    {
      id: "safeguarding",
      title: "15. Safeguarding and Escalation",
      blocks: [
        { kind: "clause", num: "15.1", text: "The Facility shall promptly escalate any suspected abuse, neglect, exploitation or other safeguarding risk identified while providing Services in accordance with its professional and legal obligations and shall notify StreetdocMD through the Platform as soon as reasonably practicable where relevant to the referral or Platform safety." },
        { kind: "clause", num: "15.2", text: "Nothing in this Agreement prevents the Facility from taking urgent action reasonably necessary to protect a Patient or another person." },
      ],
    },
    {
      id: "termination",
      title: "16. Suspension and Termination",
      blocks: [
        { kind: "clause", num: "16.1", text: "StreetdocMD may immediately suspend the Facility’s Platform access where it reasonably considers suspension necessary because of patient safety, licensing status, insurance lapse, suspected fraud, a serious complaint, data-security risk, circumvention or a material breach, pending investigation." },
        { kind: "clause", num: "16.2", text: "StreetdocMD shall communicate the general basis for suspension as soon as reasonably practicable, subject to confidentiality, safety, legal and regulatory constraints, and may require specified evidence before reinstatement." },
        { kind: "clause", num: "16.3", text: "Either Party may terminate this Agreement for convenience on thirty (30) days’ written notice." },
        { kind: "clause", num: "16.4", text: "Either Party may terminate immediately for a material breach that is incapable of remedy or, where capable of remedy, is not remedied within fourteen (14) days after written notice. StreetdocMD may terminate immediately for loss or suspension of required licensing, lapse of required insurance, serious patient-safety conduct, fraud, deliberate circumvention or repeated material breaches." },
        { kind: "clause", num: "16.5", text: "Termination does not affect accrued rights, settlement of amounts properly due, pending refunds or chargebacks, lawful record-retention duties, confidentiality, data-protection obligations, indemnities or provisions intended by their nature to survive termination." },
      ],
    },
    {
      id: "force-majeure",
      title: "17. Force Majeure",
      blocks: [
        { kind: "clause", num: "17.1", text: "Neither Party is liable for delay or failure to perform an obligation, other than payment of an amount already due, to the extent caused by an event beyond its reasonable control, including natural disaster, epidemic, government action, civil disturbance, widespread telecommunications or utility failure, or material payment-network outage." },
        { kind: "clause", num: "17.2", text: "The affected Party shall notify the other as soon as reasonably practicable and use reasonable efforts to mitigate the effect. Nothing in this Clause excuses a Party from taking steps required for patient safety, confidentiality or data security that remain reasonably possible." },
      ],
    },
    {
      id: "disputes",
      title: "18. Dispute Resolution",
      blocks: [
        { kind: "clause", num: "18.1", text: "A dispute arising out of or in connection with this Agreement shall first be referred to authorised representatives of the Parties for good-faith negotiation following written notice of the dispute." },
        { kind: "clause", num: "18.2", text: "If the dispute is not resolved within fourteen (14) days after that notice, either Party may refer it to mediation at the Oyo State Multi-Door Courthouse in Ibadan." },
        { kind: "clause", num: "18.3", text: "If the dispute is not resolved through mediation within thirty (30) days after commencement of mediation, it shall be finally resolved by arbitration in accordance with the Arbitration and Mediation Act 2023. The tribunal shall consist of one arbitrator jointly appointed by the Parties, failing which the appointment shall be made in accordance with the Act. The seat of arbitration shall be Ibadan, Oyo State, Nigeria, and the language shall be English." },
        { kind: "clause", num: "18.4", text: "Nothing in this Clause prevents a Party from seeking urgent interim or protective relief from a court of competent jurisdiction." },
      ],
    },
    {
      id: "notices",
      title: "19. Notices",
      blocks: [
        { kind: "clause", num: "19.1", text: "A notice under this Agreement may be delivered through the Facility Partner account, to the email address registered to that account, by hand, or by recognised courier to the latest contact details provided by the relevant Party." },
        { kind: "clause", num: "19.2", text: "A Platform notice is deemed received when made available in the Facility Partner account; an email on the next Business Day after transmission unless a delivery-failure notice is received; a hand-delivered notice on delivery; and a courier notice on recorded delivery." },
        {
          kind: "table",
          headers: ["Party", "Notice Address", "Notice Email"],
          rows: [
            ["StreetdocMD", "Through www.streetdocmd.com / Platform account", "contact@streetdocmd.com"],
            ["Facility", "Latest address in Facility Partner account", "Registered account email"],
          ],
        },
      ],
    },
    {
      id: "assignment",
      title: "20. Assignment and Change of Control",
      blocks: [
        { kind: "clause", num: "20.1", text: "The Facility shall not assign, transfer, novate or subcontract this Agreement or transfer its Platform account to another facility without StreetdocMD’s prior written consent, because onboarding and verification are specific to the approved Facility." },
        { kind: "clause", num: "20.2", text: "StreetdocMD may assign or novate this Agreement to an Affiliate or in connection with a bona fide merger, reorganisation, financing, sale of substantially all relevant assets or transfer of the Platform business, on written notice to the Facility, provided the assignee assumes StreetdocMD’s material obligations." },
      ],
    },
    {
      id: "general",
      title: "21. General Provisions",
      blocks: [
        { kind: "clause", num: "21.1", text: "This Agreement is governed by the laws of the Federal Republic of Nigeria." },
        { kind: "clause", num: "21.2", text: "This Agreement, the Facility’s onboarding particulars, the accepted version of the schedules and any Platform terms expressly incorporated at the point of acceptance constitute the entire agreement between the Parties concerning its subject matter." },
        { kind: "clause", num: "21.3", text: "A material amendment to this Agreement shall be presented through the Platform or another durable electronic method. StreetdocMD may require affirmative re-acceptance before continued Platform access. Reasonable non-material operational policies may be updated through the Platform, and the applicable Agreement version and acceptance record shall be retained electronically." },
        { kind: "clause", num: "21.4", text: "If a provision is invalid, illegal or unenforceable, it shall be modified to the minimum extent necessary to make it enforceable where lawful, and the remaining provisions continue in effect." },
        { kind: "clause", num: "21.5", text: "A failure or delay to exercise a right is not a waiver. A waiver is effective only if in writing and applies only to the specific circumstance for which it is given." },
        { kind: "clause", num: "21.6", text: "This Agreement is intended to be concluded electronically through the sign-up process in Clause 2 and does not require a handwritten signature or company seal. The Parties may also execute a written counterpart or addendum where they choose to do so." },
        { kind: "clause", num: "21.7", text: "If there is a conflict between the main body and a Schedule, the main body prevails unless the Schedule expressly states that it overrides a specified clause for a stated commercial matter." },
      ],
    },
    {
      id: "contract-record",
      title: "22. Electronic Contract Record",
      blocks: [
        { kind: "p", text: "No separate handwritten signature page is required for the standard Platform onboarding process. The Facility accepts this Agreement electronically in accordance with Clause 2." },
        { kind: "p", text: "StreetdocMD should retain the following information as part of the contract audit trail for each Facility Partner:" },
        {
          kind: "table",
          headers: ["Electronic Contract Field", "Recorded Value"],
          rows: [
            ["Facility legal name", "Captured from Facility Partner sign-up"],
            ["RC/BN number", "Captured from Facility Partner sign-up"],
            ["Facility Type", "Laboratory / Pharmacy / Hospital"],
            ["Authorised representative", "Name/account identifier of accepting user"],
            ["Registered email / phone", "Captured from Facility Partner sign-up"],
            ["Agreement version", "Version displayed or linked at acceptance"],
            ["Acceptance statement", "Affirmative checkbox/button acceptance"],
            ["Acceptance date and time", "System timestamp"],
            ["Regulatory licence details", "Captured from onboarding / verification"],
            ["Approved premises", "Captured from onboarding / verification"],
          ],
        },
      ],
    },
    {
      id: "schedule-1",
      title: "Schedule 1 — Platform Commercial Terms",
      blocks: [
        { kind: "p", text: "The following commercial terms apply to Facility Partners using the Platform:" },
        { kind: "clause", num: "S1.1", text: "The Facility sets and controls its own Facility Prices." },
        { kind: "clause", num: "S1.2", text: "StreetdocMD does not charge the Facility a percentage commission or referral fee on the Facility Price." },
        { kind: "clause", num: "S1.3", text: "The Facility bears the applicable Paystack or replacement payment-processor charges attributable to payments collected for the Facility, and those charges may be deducted from its Platform balance." },
        { kind: "clause", num: "S1.4", text: "The Facility may initiate withdrawal of its available Platform balance at any time permitted by the Platform, subject to Clause 8.3." },
        { kind: "clause", num: "S1.5", text: "A Laboratory may set a separate home sample-collection fee and a Pharmacy may set a separate delivery/dispatch fee. The applicable Facility is responsible for the phlebotomist, collection personnel, dispatch rider or courier and for paying its related operational costs." },
        { kind: "clause", num: "S1.6", text: "StreetdocMD may charge Patients a separate Patient Service Fee. That fee is separate from and does not reduce the Facility Price or any Ancillary Service Fee payable to the Facility." },
        { kind: "clause", num: "S1.7", text: "Refunds, reversals, disputed transactions and chargebacks are handled in accordance with Clauses 8.5 and 8.6. Payment processor: Paystack, or another processor notified by StreetdocMD where reasonably necessary." },
      ],
    },
    {
      id: "schedule-2",
      title: "Schedule 2 — Services, Pricing and Service Levels",
      blocks: [
        { kind: "p", text: "The Facility’s current services, Facility Prices, availability and applicable turnaround/service levels are those entered and maintained by the Facility through its Platform account. Those Platform entries are incorporated into this Agreement and may be updated prospectively by the Facility, subject to Clause 8.2." },
        {
          kind: "table",
          headers: ["Service", "Facility Price", "Availability", "Turnaround / SLA", "Ancillary Fee / Platform Record"],
          rows: [
            ["As maintained by Facility", "As maintained by Facility", "As maintained by Facility", "As maintained by Facility", "Collection/delivery fee (if any) maintained in Facility Partner account"],
          ],
        },
      ],
    },
    {
      id: "schedule-3",
      title: "Schedule 3 — Data-Processing Particulars",
      blocks: [
        { kind: "p", text: "This Schedule applies where the Facility acts as StreetdocMD’s data processor under Clause 7.3." },
        {
          kind: "table",
          headers: ["Item", "Particulars"],
          rows: [
            ["Subject matter", "Transmission and handling of Patient information required to fulfil a referral/order through the Platform."],
            ["Duration", "For the duration of the relevant processing and any legally required retention period."],
            ["Nature and purpose", "Referral/order fulfilment, Platform communication, service-status updates, and related operational processing on StreetdocMD’s documented instructions."],
            ["Data subjects", "Patients, lawful representatives/caregivers, and where relevant referring healthcare Providers."],
            ["Data categories", "Identity/contact details, referral/order information, health and clinical information relevant to the Service, payment/status metadata, and communications."],
            ["Sensitive personal data", "Health and medical information and any other sensitive personal data lawfully required for the Service."],
            ["Approved sub-processors", "Any sub-processor authorised in accordance with Clause 7.3 and notified or made available to the Facility through the Platform or applicable privacy/data-processing documentation."],
            ["Processing location / transfers", "Nigeria and any other location lawfully used by StreetdocMD or an authorised service provider, subject to applicable cross-border transfer requirements and safeguards."],
          ],
        },
      ],
    },
  ],
  // Platform Acceptance Screen wording (unchecked by default, before "Complete Sign-Up")
  acceptanceLabels: [
    "I confirm that I am authorised to bind the Facility identified in this sign-up. I have read and agree to the StreetdocMD Facility Partner Platform Service Agreement, including the applicable platform commercial terms and schedules.",
  ],
};
