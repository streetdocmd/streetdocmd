// Care journey medical report (migration 068), built with pdf-lib.
// "full" adds the care team's chat; the patient's copy leaves it out because
// patients don't see the chat.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

const NAVY = rgb(0.05, 0.17, 0.37);
const INK = rgb(0.07, 0.11, 0.18);
const MUTED = rgb(0.36, 0.41, 0.47);
const LINE = rgb(0.86, 0.89, 0.94);

// Helvetica covers Latin-1 only: show the naira sign as "NGN" and drop anything else it can't draw
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/₦/g, "NGN ")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/·/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";
const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) { this.newPage(); }

  newPage() {
    this.page = this.doc.addPage([595.28, 841.89]); // A4
    this.y = 800;
  }

  private ensure(h: number) {
    if (this.y - h < 50) this.newPage();
  }

  private wrap(text: string, size: number, width: number, font: PDFFont) {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; }
        else line = next;
      }
      out.push(line);
    }
    return out;
  }

  text(t: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = 50 + (opts.indent ?? 0);
    for (const line of this.wrap(t, size, 495 - (opts.indent ?? 0), font)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y, size, font, color: opts.color ?? INK });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 2;
  }

  heading(t: string) {
    this.ensure(40);
    this.y -= 10;
    this.page.drawText(clean(t), { x: 50, y: this.y, size: 13, font: this.bold, color: NAVY });
    this.y -= 6;
    this.page.drawLine({ start: { x: 50, y: this.y }, end: { x: 545, y: this.y }, thickness: 0.8, color: LINE });
    this.y -= 14;
  }

  row(label: string, value: string) {
    if (!value) return;
    this.text(`${label}: ${value}`, { size: 10 });
  }
}

export async function buildCareReport(admin: SupabaseClient, episodeId: string, variant: "full" | "patient") {
  const { data: ep } = await admin
    .from("care_episodes")
    .select("*, users!patient_id(name, dob, gender, phone, allergies, known_conditions), lead:providers!care_episodes_lead_provider_id_fkey(name, profession)")
    .eq("id", episodeId)
    .maybeSingle();
  if (!ep) throw new Error("Care journey not found");

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, service_type, status, created_at, scheduled_at, completed_at, providers!bookings_provider_id_fkey(name, profession)")
    .eq("care_episode_id", episodeId)
    .order("created_at");
  const bookingIds = (bookings ?? []).map(b => b.id);

  const [team, visits, prescriptions, medOrders, tests, referrals, followUps, messages] = await Promise.all([
    admin.from("care_team_members").select("is_lead, joined_at, providers(name, profession)").eq("care_episode_id", episodeId),
    bookingIds.length ? admin.from("visits").select("booking_id, chief_complaint, diagnosis, treatment, follow_up_plan, created_at").in("booking_id", bookingIds) : Promise.resolve({ data: [] }),
    bookingIds.length ? admin.from("prescriptions").select("drugs, notes, created_at, providers(name)").in("booking_id", bookingIds).order("created_at") : Promise.resolve({ data: [] }),
    admin.from("prescription_orders").select("status, drugs, created_at, pharmacy_partners(name)").eq("care_episode_id", episodeId).order("created_at"),
    admin.from("investigation_orders").select("status, tests, ordered_at, resulted_at, clinical_notes, review_interpretation, review_next_step, review_notes, lab_partners(name), providers(name), investigation_results(test_name, result_value, unit, reference_range, flag)").eq("care_episode_id", episodeId).order("ordered_at"),
    admin.from("hospital_referrals").select("status, urgency, reason, referred_at, hospital_partners(name)").eq("care_episode_id", episodeId),
    admin.from("follow_ups").select("follow_up_type, follow_up_date, reason, status").eq("care_episode_id", episodeId).order("follow_up_date"),
    admin.from("care_journey_messages").select("sender_label, body, kind, created_at").eq("care_episode_id", episodeId).order("created_at").limit(2000),
  ]);

  const doc = await PDFDocument.create();
  doc.setTitle(`Care journey report - ${clean((ep.users as any)?.name)}`);
  doc.setProducer("StreetdocMD");
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  const patient = ep.users as any;
  w.text("StreetdocMD", { size: 11, bold: true, color: NAVY, gap: 0 });
  w.text(variant === "full" ? "Care journey report (full record)" : "Medical report", { size: 18, bold: true, color: NAVY, gap: 4 });
  w.text(`Generated ${dateTime(new Date().toISOString())}. Confidential health information.`, { size: 9, color: MUTED, gap: 6 });

  w.heading("Patient");
  w.row("Name", clean(patient?.name));
  w.row("Date of birth", day(patient?.dob));
  w.row("Sex", clean(patient?.gender));
  w.row("Allergies", (patient?.allergies ?? []).filter(Boolean).join(", ") || "None recorded");
  w.row("Known conditions", (patient?.known_conditions ?? []).filter(Boolean).join(", "));

  w.heading("Care journey");
  w.row("Title", clean(ep.title));
  w.row("Reason", clean(ep.reason));
  w.row("Started", day(ep.start_date ?? ep.created_at));
  w.row("Status", clean(ep.status));
  w.row("Lead clinician", clean((ep as any).lead?.name));
  w.row("Patient confirmed recovery", dateTime(ep.recovered_at));
  if (ep.recovery_note) w.row("Patient's note", clean(ep.recovery_note));
  w.row("Closed", dateTime(ep.closed_at));

  const teamRows = (team.data ?? []) as any[];
  if (teamRows.length) {
    w.heading("Care team");
    for (const m of teamRows) w.text(`${clean(m.providers?.name)} (${clean(m.providers?.profession)})${m.is_lead ? ", lead" : ""}, joined ${day(m.joined_at)}`);
  }

  if ((bookings ?? []).length) {
    w.heading("Visits");
    for (const b of bookings as any[]) {
      w.text(`${clean(String(b.service_type).replace(/_/g, " "))} with ${clean(b.providers?.name ?? "provider")}`, { bold: true });
      w.text(`${clean(b.status)} - booked ${dateTime(b.created_at)}${b.completed_at ? `, completed ${dateTime(b.completed_at)}` : ""}`, { color: MUTED, indent: 10 });
      const v = ((visits.data ?? []) as any[]).find(x => x.booking_id === b.id);
      if (v) {
        if (v.chief_complaint) w.text(`Complaint: ${v.chief_complaint}`, { indent: 10 });
        if (v.diagnosis) w.text(`Diagnosis: ${v.diagnosis}`, { indent: 10 });
        if (v.treatment) w.text(`Treatment: ${v.treatment}`, { indent: 10 });
        if (v.follow_up_plan) w.text(`Plan: ${v.follow_up_plan}`, { indent: 10 });
      }
      w.text("", { gap: 2 });
    }
  }

  const rx = (prescriptions.data ?? []) as any[];
  const orders = (medOrders.data ?? []) as any[];
  if (rx.length || orders.length) {
    w.heading("Medicines");
    for (const p of rx) {
      w.text(`Prescribed by ${clean(p.providers?.name ?? "the doctor")} on ${day(p.created_at)}`, { bold: true });
      for (const d of (p.drugs ?? []) as any[]) {
        w.text(`- ${clean(d.name ?? d.drug_name)} ${clean([d.dosage, d.frequency, d.duration].filter(Boolean).join(", "))}`, { indent: 10 });
      }
    }
    for (const o of orders) {
      w.text(`Order from ${clean(o.pharmacy_partners?.name ?? "pharmacy")} (${clean(o.status)}), ${day(o.created_at)}: ${clean(((o.drugs ?? []) as any[]).map(d => d.drug_name).join(", "))}`);
    }
  }

  const inv = (tests.data ?? []) as any[];
  if (inv.length) {
    w.heading("Tests and results");
    for (const o of inv) {
      w.text(`${clean(((o.tests ?? []) as any[]).map(t => t.test_name).join(", "))}`, { bold: true });
      w.text(`${clean(o.status.replace(/_/g, " "))}${o.lab_partners?.name ? ` - ${clean(o.lab_partners.name)}` : ""} - ordered ${day(o.ordered_at)}${o.providers?.name ? ` by ${clean(o.providers.name)}` : ""}`, { color: MUTED, indent: 10 });
      if (o.clinical_notes) w.text(`Indication: ${o.clinical_notes}`, { indent: 10 });
      for (const r of (o.investigation_results ?? []) as any[]) {
        if (!r.result_value) continue;
        w.text(`${clean(r.test_name)}: ${clean(r.result_value)}${r.unit ? ` ${clean(r.unit)}` : ""}${r.reference_range ? ` (reference ${clean(r.reference_range)})` : ""}${r.flag && r.flag !== "normal" ? ` - ${clean(r.flag).toUpperCase()}` : ""}`, { indent: 10 });
      }
      if (o.review_interpretation) w.text(`Doctor's review: ${o.review_interpretation}`, { indent: 10 });
      if (o.review_next_step) w.text(`Next step: ${clean(o.review_next_step.replace(/_/g, " "))}${o.review_notes ? `. ${o.review_notes}` : ""}`, { indent: 10 });
      w.text("", { gap: 2 });
    }
  }

  const refs = (referrals.data ?? []) as any[];
  if (refs.length) {
    w.heading("Referrals");
    for (const r of refs) w.text(`${clean(r.hospital_partners?.name ?? "Hospital")} (${clean(r.urgency)}, ${clean(r.status)}), ${day(r.referred_at)}: ${clean(r.reason)}`);
  }

  const fus = (followUps.data ?? []) as any[];
  if (fus.length) {
    w.heading("Follow ups");
    for (const f of fus) w.text(`${clean(String(f.follow_up_type).replace(/_/g, " "))} on ${day(f.follow_up_date)} (${clean(f.status)})${f.reason ? `: ${clean(f.reason)}` : ""}`);
  }

  const msgs = (messages.data ?? []) as any[];
  const updates = msgs.filter(m => m.kind === "update");
  if (updates.length) {
    w.heading("Timeline");
    for (const m of updates) w.text(`${dateTime(m.created_at)}  ${m.body}`, { size: 9 });
  }

  if (variant === "full") {
    const chat = msgs.filter(m => m.kind === "message");
    w.heading("Care team conversation");
    if (!chat.length) w.text("No messages.", { color: MUTED });
    for (const m of chat) {
      w.text(`${clean(m.sender_label)}, ${dateTime(m.created_at)}`, { size: 9, bold: true, gap: 0 });
      w.text(m.body, { size: 9, indent: 10 });
    }
  }

  w.text("", { gap: 10 });
  w.text("This report reflects the records held by StreetdocMD at the time it was generated. Lab values are shown as reported by the lab and are not a diagnosis.", { size: 8, color: MUTED });

  return doc.save();
}
