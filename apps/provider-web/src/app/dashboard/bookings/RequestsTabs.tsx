"use client";
import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ds";

type Tab = "new" | "scheduled" | "declined" | "past";

// New / Scheduled / Declined (the design) plus Past (visit history with notes).
// All four lists are rendered on the server; this only chooses which shows.
export default function RequestsTabs({ panels, counts, initial }: {
  panels: Record<Tab, ReactNode>;
  counts: Record<Tab, number>;
  initial: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const label = (t: Tab, l: string) => (counts[t] ? `${l} ${counts[t]}` : l);
  return (
    <>
      <SegmentedControl
        label="Requests"
        value={tab}
        onChange={setTab}
        options={[
          { value: "new", label: label("new", "New") },
          { value: "scheduled", label: label("scheduled", "Scheduled") },
          { value: "declined", label: "Declined" },
          { value: "past", label: "Past" },
        ]}
      />
      <div className="mt-4">{panels[tab]}</div>
    </>
  );
}
