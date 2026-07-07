"use client";
import { useState } from "react";

export default function Step14FollowUp({ noteId, patientId, value, onChange }: {
  noteId: string;
  patientId?: string;
  value: { date: string | null; safeguarding: boolean };
  onChange: (v: { date: string | null; safeguarding: boolean }) => void;
}) {
  const [date, setDate] = useState(value.date ?? "");
  const [safeguarding, setSafeguarding] = useState(value.safeguarding ?? false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const handleDate = (v: string) => {
    setDate(v);
    onChange({ date: v || null, safeguarding });
  };

  const handleSafeguarding = (v: boolean) => {
    setSafeguarding(v);
    onChange({ date: date || null, safeguarding: v });
  };

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Step 14 — Follow-Up Date</h2>
        <p className="text-sm text-gray-500 mt-0.5">Schedule patient follow-up and complete safeguarding check</p>
      </div>

      {/* Follow-up date */}
      <div className="card p-4 space-y-3">
        <label className="text-sm font-semibold text-gray-700">Follow-up Date</label>
        <input
          type="date"
          min={minDate}
          value={date}
          onChange={e => handleDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {date && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-green-800">Follow-up scheduled for {formatDate(date)}</p>
            <p className="text-xs text-green-600">Your patient will receive:</p>
            <ul className="text-xs text-green-600 ml-3 space-y-0.5">
              <li>• A reminder notification the day before</li>
              <li>• A reminder on the morning of their follow-up</li>
            </ul>
          </div>
        )}
      </div>

      {/* Safeguarding Flag */}
      <div className="border-2 border-red-400 bg-red-50 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={safeguarding}
            onChange={e => handleSafeguarding(e.target.checked)}
            className="mt-1 w-4 h-4 accent-red-600"
          />
          <div>
            <p className="text-red-800 font-semibold text-sm">I have concerns about this patient's safety or welfare.</p>
            <p className="text-red-600 text-xs mt-0.5">This will be flagged confidentially to the StreetdocMD clinical team. It will never appear in patient-facing communications.</p>
          </div>
        </label>
      </div>
    </div>
  );
}
