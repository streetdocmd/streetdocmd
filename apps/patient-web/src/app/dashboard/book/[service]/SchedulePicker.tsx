"use client";
import { useState } from "react";

function minDateTimeLocal(): string {
  // At least 1 hour from now, formatted for <input type="datetime-local">
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function SchedulePicker({
  onChange,
}: {
  // scheduledAt is null for ASAP; ready is false only when "Choose a time"
  // is selected but no time has been picked yet — callers should block
  // booking in that case rather than silently falling back to ASAP.
  onChange: (scheduledAt: string | null, ready: boolean) => void;
}) {
  const [mode, setMode] = useState<"asap" | "scheduled">("asap");
  const [value, setValue] = useState("");

  function selectAsap() {
    setMode("asap");
    onChange(null, true);
  }

  function selectScheduled() {
    setMode("scheduled");
    onChange(value ? new Date(value).toISOString() : null, !!value);
  }

  function handleTimeChange(v: string) {
    setValue(v);
    onChange(v ? new Date(v).toISOString() : null, !!v);
  }

  return (
    <div className="card p-5 space-y-3">
      <p className="font-semibold text-gray-900 text-sm">When do you need this?</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={selectAsap}
          className={`text-sm font-medium rounded-xl py-3 border transition-colors ${
            mode === "asap" ? "border-blue-brand bg-blue-50 text-blue-brand" : "border-gray-200 text-gray-600"
          }`}
        >
          As soon as possible
        </button>
        <button
          type="button"
          onClick={selectScheduled}
          className={`text-sm font-medium rounded-xl py-3 border transition-colors ${
            mode === "scheduled" ? "border-blue-brand bg-blue-50 text-blue-brand" : "border-gray-200 text-gray-600"
          }`}
        >
          Choose a time
        </button>
      </div>

      {mode === "scheduled" && (
        <input
          type="datetime-local"
          className="input"
          min={minDateTimeLocal()}
          value={value}
          onChange={e => handleTimeChange(e.target.value)}
          required
        />
      )}
    </div>
  );
}
