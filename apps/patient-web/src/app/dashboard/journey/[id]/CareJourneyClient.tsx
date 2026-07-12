"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JourneyStep {
  key: string;
  icon: string;
  label: string;
  sublabel?: string;
  timestamp: string | null;
  status: "complete" | "active" | "upcoming";
  details: {
    label: string;
    value: string;
    href?: string;
    flag?: "normal" | "high" | "low" | "critical";
  }[];
}

// ─── Flag badge ───────────────────────────────────────────────────────────────

const FLAG_CLASSES: Record<string, string> = {
  normal:   "bg-green-50 text-green-700 border border-green-200",
  high:     "bg-orange-50 text-orange-700 border border-orange-200",
  low:      "bg-blue-50 text-blue-700 border border-blue-200",
  critical: "bg-red-50 text-red-700 border border-red-200",
};

// ─── Dot component ────────────────────────────────────────────────────────────

function StepDot({ status, icon }: { status: JourneyStep["status"]; icon: string }) {
  if (status === "complete") {
    return (
      <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500 shadow-sm ring-4 ring-white">
        <span className="text-base">{icon}</span>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 shadow-sm ring-4 ring-white animate-pulse">
        <span className="text-base">{icon}</span>
      </div>
    );
  }
  return (
    <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 ring-4 ring-white">
      <span className="text-base opacity-40">{icon}</span>
    </div>
  );
}

// ─── Single step ─────────────────────────────────────────────────────────────

function TimelineStep({
  step,
  isLast,
  expanded,
  onToggle,
}: {
  step: JourneyStep;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isUpcoming  = step.status === "upcoming";
  const isComplete  = step.status === "complete";
  const hasDetails  = step.details.length > 0;
  const isClickable = isComplete && hasDetails;

  return (
    <div className="relative flex gap-4">
      {/* Vertical connecting line */}
      {!isLast && (
        <div
          className={`absolute left-5 top-10 bottom-0 w-0.5 ${
            isUpcoming ? "bg-gray-100" : "bg-green-200"
          }`}
          style={{ transform: "translateX(-50%)" }}
        />
      )}

      {/* Dot */}
      <StepDot status={step.status} icon={step.icon} />

      {/* Content */}
      <div
        className={`flex-1 pb-8 min-w-0 ${isClickable ? "cursor-pointer" : ""}`}
        onClick={isClickable ? onToggle : undefined}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold leading-tight ${
                isUpcoming ? "text-gray-400" : "text-gray-900"
              }`}
            >
              {step.label}
            </p>
            {step.timestamp && (
              <p className={`mt-0.5 text-xs ${isUpcoming ? "text-gray-300" : "text-gray-500"}`}>
                {step.timestamp}
              </p>
            )}
            {!step.timestamp && step.status === "active" && (
              <p className="mt-0.5 text-xs text-blue-500 font-medium">In progress…</p>
            )}
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0 flex items-center gap-1.5">
            {step.status === "complete" && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                Done
              </span>
            )}
            {step.status === "active" && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                Active
              </span>
            )}
            {isClickable && (
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>

        {/* Expanded detail panel */}
        {isComplete && hasDetails && expanded && (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
            {step.details.map((d, i) => (
              <div
                key={i}
                className={`px-4 py-3 flex items-start gap-3 ${
                  i < step.details.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="text-xs font-semibold text-gray-500 w-28 flex-shrink-0 pt-0.5 uppercase tracking-wide">
                  {d.label}
                </span>
                <div className="flex-1 min-w-0">
                  {d.href ? (
                    <a
                      href={d.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-words"
                      onClick={e => e.stopPropagation()}
                    >
                      {d.value}
                    </a>
                  ) : (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-sm text-gray-800 break-words">{d.value}</span>
                      {d.flag && d.flag !== "normal" && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${FLAG_CLASSES[d.flag] ?? ""}`}
                        >
                          {d.flag === "high" ? "High ↑" : d.flag === "low" ? "Low ↓" : "Critical ⚠"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary bar at top ───────────────────────────────────────────────────────

function JourneySummary({ steps }: { steps: JourneyStep[] }) {
  const total    = steps.length;
  const complete = steps.filter(s => s.status === "complete").length;
  const pct      = Math.round((complete / total) * 100);

  const lastComplete = [...steps].reverse().find(s => s.status === "complete");

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Journey Progress</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {complete} of {total} steps completed
          </p>
        </div>
        <span className="text-2xl font-bold text-green-600">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {lastComplete && (
        <p className="mt-3 text-xs text-gray-500">
          Latest: <span className="font-medium text-gray-700">{lastComplete.label}</span>
          {lastComplete.timestamp && <span> · {lastComplete.timestamp}</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CareJourneyClient({ steps }: { steps: JourneyStep[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the last completed step so there's something to see immediately
    const last = [...steps].reverse().find(s => s.status === "complete" && s.details.length > 0);
    return last ? new Set([last.key]) : new Set();
  });

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const activeStep = steps.find(s => s.status === "active");

  return (
    <div>
      <JourneySummary steps={steps} />

      {activeStep && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{activeStep.label}</span> is currently in progress
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
          Timeline · tap any completed step to expand
        </p>

        <div>
          {steps.map((step, i) => (
            <TimelineStep
              key={step.key}
              step={step}
              isLast={i === steps.length - 1}
              expanded={expanded.has(step.key)}
              onToggle={() => toggle(step.key)}
            />
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-gray-400">
        All your care information is securely stored · StreetdocMD
      </p>
    </div>
  );
}
