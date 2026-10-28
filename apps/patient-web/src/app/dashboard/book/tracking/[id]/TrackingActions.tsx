"use client";
import { useState } from "react";
import { CalendarPlus, CalendarClock, Mail, Share2 } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { Button } from "@/components/ds";

function icsFor(startIso: string, minutes: number, title: string, where: string | null) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = new Date(startIso);
  const end = new Date(start.getTime() + minutes * 60_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StreetdocMD//Visit//EN", "BEGIN:VEVENT",
    `UID:${startIso}-${title.replace(/\W/g, "")}@streetdocmd.com`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${title}`,
    where ? `LOCATION:${where.replace(/[,;]/g, " ")}` : "", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

// Share, calendar and reschedule actions on the tracking screen
export default function TrackingActions({ bookingId, providerName, scheduledAt, durationMinutes, address, live }: {
  bookingId: string;
  providerName: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
  address: string | null;
  /** Provider on the way or with the patient */
  live: boolean;
}) {
  const [shared, setShared] = useState("");
  const who = providerName ?? "a StreetdocMD provider";
  const when = scheduledAt
    ? new Date(scheduledAt).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  // A short message for family. It names who is visiting and when; it doesn't send a live location link.
  async function share() {
    const text = live
      ? `I'm having a home visit from ${who} through StreetdocMD. They're on the way now.`
      : `I have a StreetdocMD home visit with ${who}${when ? ` on ${when}` : ""}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My StreetdocMD visit", text });
        setShared("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        setShared("Copied to share");
      }
    } catch {
      // the share sheet was closed: nothing to do
    }
  }

  function addToCalendar() {
    if (!scheduledAt) return;
    const blob = new Blob([icsFor(scheduledAt, durationMinutes, `StreetdocMD visit with ${who}`, address)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "streetdocmd-visit.ics"; a.click();
    URL.revokeObjectURL(url);
  }

  const ref = bookingId.slice(0, 8).toUpperCase();
  const rescheduleHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Reschedule visit ${ref}`)}&body=${encodeURIComponent(`Please help me reschedule my visit (reference ${ref})${when ? `, currently ${when}` : ""}. A time that suits me better is: `)}`;

  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5">
      {scheduledAt && !live ? (
        <>
          <Button variant="secondary" onClick={addToCalendar}><CalendarPlus size={18} aria-hidden /> Add to calendar</Button>
          <Button variant="secondary" href={rescheduleHref}><CalendarClock size={18} aria-hidden /> Reschedule</Button>
        </>
      ) : (
        <Button variant="secondary" onClick={share}><Share2 size={18} aria-hidden /> {shared || "Share"}</Button>
      )}
      <Button variant="secondary" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help with visit ${ref}`)}`}
        className={scheduledAt && !live ? "col-span-2" : ""}>
        <Mail size={18} aria-hidden /> Get help
      </Button>
    </div>
  );
}
