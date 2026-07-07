"use client";
import Link from "next/link";

const FLAG_COLORS: Record<string, string> = {
  "Blood Pressure": "text-orange-700",
  "Pulse Rate": "text-orange-700",
  "Temperature": "text-orange-700",
  "Oxygen Saturation": "text-orange-700",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}

function generateICS(date: string, providerName: string): string {
  const d = new Date(date);
  const stamp = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:${date.replace(/-/g, "")}\nDTEND;VALUE=DATE:${date.replace(/-/g, "")}\nSUMMARY:StreetdocMD Follow-up with ${providerName}\nDESCRIPTION:Follow-up appointment scheduled from your StreetdocMD visit.\nDTSTAMP:${stamp}\nEND:VEVENT\nEND:VCALENDAR`;
}

export default function VisitSummaryClient({ summary }: { summary: any }) {
  const abnormal: any[] = summary.abnormal_vitals ?? [];
  const medications: any[] = summary.medications ?? [];
  const investigations: any[] = summary.investigations ?? [];
  const diagnoses: string[] = summary.plain_diagnosis?.split(",").map((d: string) => d.trim()).filter(Boolean) ?? [];

  const addToCalendar = () => {
    if (!summary.follow_up_date) return;
    const content = generateICS(summary.follow_up_date, summary.provider_name ?? "Your Doctor");
    const blob = new Blob([content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "streetdocmd-followup.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    window.print();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Card 1 — Header */}
      <div className="bg-teal-600 text-white rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-200 mb-1">StreetdocMD Home Visit Summary</p>
        <h1 className="text-xl font-bold">{summary.provider_name ?? "Your Doctor"}</h1>
        <p className="text-teal-200 text-sm mt-0.5">
          {summary.visit_date
            ? new Date(summary.visit_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            : "Visit date"}
        </p>
      </div>

      {/* Card 2 — Reason for visit */}
      <Card title="Why we visited">
        <p className="text-base text-gray-800 leading-relaxed">{summary.reason_for_visit ?? "—"}</p>
      </Card>

      {/* Card 3 — Diagnosis */}
      <Card title="What was found">
        {diagnoses.length > 1 ? (
          <ol className="space-y-1">
            {diagnoses.map((d, i) => (
              <li key={i} className="text-lg text-gray-900 font-semibold">{i + 1}. {d}</li>
            ))}
          </ol>
        ) : (
          <p className="text-xl font-bold text-gray-900">{diagnoses[0] ?? "—"}</p>
        )}
      </Card>

      {/* Card 4 — Abnormal Vitals */}
      {abnormal.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest">Important Readings</h3>
          {abnormal.map((v: any, i: number) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-amber-600">⚠</span>
                <span className="font-semibold text-amber-800">{v.vital}: {v.value}</span>
              </div>
              <p className="text-sm text-amber-700 ml-5">{v.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Card 5 — What was done */}
      <Card title="What happened during your visit">
        <p className="text-base text-gray-700 leading-relaxed">{summary.what_was_done ?? "—"}</p>
      </Card>

      {/* Card 6 — Medications */}
      {medications.length > 0 && (
        <Card title="Your medications">
          <div className="space-y-3">
            {medications.map((m: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-1">
                <p className="font-semibold text-gray-900 text-base">{m.name}</p>
                {m.what_it_treats && <p className="text-sm text-gray-500">For: {m.what_it_treats}</p>}
                <p className="text-sm text-gray-700">How to take: <span className="font-medium">{m.how_to_take}</span></p>
                {m.duration && <p className="text-sm text-gray-600">Duration: {m.duration}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Card 7 — Investigations */}
      {investigations.length > 0 && (
        <Card title="Tests ordered">
          <div className="space-y-2">
            {investigations.map((inv: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-blue-500 mt-0.5">🔬</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{inv.test_name}</p>
                  {inv.expected_timeline && <p className="text-xs text-gray-500">{inv.expected_timeline}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Card 8 — Recommendations */}
      {summary.recommendations && (
        <Card title="What to do next">
          <ul className="space-y-1">
            {summary.recommendations.split(".").filter((s: string) => s.trim()).map((s: string, i: number) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-teal-500 mt-0.5">•</span>
                <span>{s.trim()}.</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Card 9 — Follow-up */}
      {summary.follow_up_date && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest">Your Next Appointment</h3>
          <p className="text-xl font-bold text-green-800">
            {new Date(summary.follow_up_date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <button
            onClick={addToCalendar}
            className="inline-flex items-center gap-2 bg-white border border-green-300 text-green-700 rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-50 transition-colors"
          >
            📅 Add to Calendar
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={downloadPDF}
          className="flex-1 bg-gray-800 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-900 transition-colors"
        >
          📄 Download as PDF
        </button>
        <Link href="/dashboard/visits" className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-semibold text-center hover:bg-gray-50 transition-colors">
          ← Back to My Visits
        </Link>
      </div>
    </div>
  );
}
