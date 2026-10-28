"use client";
import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ds";

// Upcoming / Past switch. Both lists are rendered on the server; this only chooses which shows.
export default function VisitsTabs({ upcoming, past, startOnPast }: { upcoming: ReactNode; past: ReactNode; startOnPast?: boolean }) {
  const [tab, setTab] = useState<"upcoming" | "past">(startOnPast ? "past" : "upcoming");
  return (
    <>
      <SegmentedControl
        label="Visits"
        value={tab}
        onChange={setTab}
        options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]}
      />
      <div className="mt-4">{tab === "upcoming" ? upcoming : past}</div>
    </>
  );
}
