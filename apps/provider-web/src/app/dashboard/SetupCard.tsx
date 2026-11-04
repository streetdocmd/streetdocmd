"use client";
import { ArrowRight } from "lucide-react";
import { Card, buttonClass } from "@/components/ds";
import { OPEN_SETUP_EVENT, type SetupState } from "@/lib/setup";

// Dashboard reminder that reopens the setup guide (which lives in the layout)
export default function SetupCard({ setup }: { setup: SetupState }) {
  if (setup.complete) return null;
  const todo = [!setup.available, ...setup.items.map(i => !i.done)].filter(Boolean).length + (setup.ratesMissing ? 1 : 0);
  return (
    <Card className="mb-4 border-accent/30">
      <b className="block text-ink">Finish setting up</b>
      <p className="mt-0.5 text-ds-sm text-muted">
        {setup.ratesMissing
          ? "Set your rates so patients can book you."
          : !setup.available
            ? "You're offline, so patients can't send you visit requests."
            : `${todo} more ${todo === 1 ? "thing" : "things"} to help patients choose you.`}
      </p>
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_SETUP_EVENT))}
        className={buttonClass("primary", false, "mt-3", "sm")}>
        Continue setup <ArrowRight size={16} aria-hidden />
      </button>
    </Card>
  );
}
