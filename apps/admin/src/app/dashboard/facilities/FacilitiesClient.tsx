"use client";
import { useState } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  pending:      "Pending",
  under_review: "Under Review",
  approved:     "Approved",
  rejected:     "Rejected",
};

const STATUS_COLOR: Record<string, string> = {
  pending:      "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  approved:     "bg-green-100 text-green-700",
  rejected:     "bg-red-100 text-red-700",
};

const TYPE_ICON: Record<string, string> = {
  lab: "🧪", pharmacy: "💊", hospital: "🏥",
};

type Tab = "all" | "lab" | "pharmacy" | "hospital" | "pending" | "approved" | "rejected";

export default function FacilitiesClient({
  applications,
  stats,
}: {
  applications: any[];
  stats: { total: number; pending: number; approvedThisMonth: number; rejected: number };
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const filtered = applications.filter(a => {
    if (tab === "all") return true;
    if (tab === "pending") return a.status === "pending" || a.status === "under_review";
    if (tab === "approved") return a.status === "approved";
    if (tab === "rejected") return a.status === "rejected";
    return a.facility_type === tab;
  });

  async function markUnderReview(id: string) {
    setMarkingId(id);
    await fetch(`/api/facilities/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "under_review" }),
    });
    setMarkingId(null);
    window.location.reload();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "lab",      label: "Labs" },
    { key: "pharmacy", label: "Pharmacies" },
    { key: "hospital", label: "Hospitals" },
    { key: "pending",  label: "Pending Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Facility Applications</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",           value: stats.total },
          { label: "Pending Review",  value: stats.pending,           color: "text-yellow-600" },
          { label: "Approved (Month)",value: stats.approvedThisMonth, color: "text-green-600" },
          { label: "Rejected",        value: stats.rejected,          color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color ?? "text-gray-900"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.key ? "border-teal-600 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">No applications in this category.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Date","Facility Name","Type","City / State","Contact","Status","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString("en-NG")}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{TYPE_ICON[a.facility_type]} {a.facility_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <p>{a.contact_person_name || a.email}</p>
                    <p className="text-xs">{a.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/facilities/${a.id}`}
                        className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-lg font-semibold hover:bg-teal-100">
                        Review
                      </Link>
                      {a.status === "pending" && (
                        <button
                          onClick={() => markUnderReview(a.id)}
                          disabled={markingId === a.id}
                          className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg font-semibold hover:bg-blue-100 disabled:opacity-50">
                          {markingId === a.id ? "…" : "Mark Under Review"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
