"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Pill, Hospital, Building, Search, Download, ChevronRight, Clock, FileCheck, FileClock } from "lucide-react";
import { missingFacilityDocs } from "@/lib/facility-docs";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ComingSoonBadge from "@/components/ComingSoonBadge";
import { Spinner } from "@/components/ui/ConfirmModal";

const TYPE_META: Record<string, { label: string; icon: typeof Pill }> = {
  lab:      { label: "Laboratory", icon: FlaskConical },
  pharmacy: { label: "Pharmacy",   icon: Pill },
  hospital: { label: "Hospital",   icon: Hospital },
};

type StatusTab = "open" | "approved" | "rejected" | "all";
type TypeFilter = "all" | "lab" | "pharmacy" | "hospital";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "open",     label: "Needs review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all",      label: "All" },
];

export default function FacilitiesClient({
  applications,
  stats,
}: {
  applications: any[];
  stats: { total: number; pending: number; approvedThisMonth: number; rejected: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("open");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const counts = useMemo(() => ({
    open: applications.filter(a => a.status === "pending" || a.status === "under_review").length,
    approved: applications.filter(a => a.status === "approved").length,
    rejected: applications.filter(a => a.status === "rejected").length,
    all: applications.length,
  }), [applications]);

  const filtered = applications.filter(a => {
    if (tab === "open" && !(a.status === "pending" || a.status === "under_review")) return false;
    if (tab === "approved" && a.status !== "approved") return false;
    if (tab === "rejected" && a.status !== "rejected") return false;
    if (type !== "all" && a.facility_type !== type) return false;
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = [a.name, a.email, a.phone, a.city, a.state, a.contact_person_name].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function markUnderReview(id: string) {
    if (markingId) return;
    setMarkingId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/facilities/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "under_review" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowError({ id, message: data.error ?? `Request failed (${res.status}).` });
      }
      router.refresh();
    } catch {
      setRowError({ id, message: "Could not reach the server." });
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Facility applications"
        description="Labs, pharmacies and hospitals applying to join the StreetdocMD partner network."
        actions={
          <button type="button" disabled aria-disabled="true" title="Coming soon" className="btn-secondary">
            <Download size={15} aria-hidden /> Export CSV <ComingSoonBadge />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Awaiting review" value={stats.pending} tone="text-amber-600" />
        <Stat label="Approved this month" value={stats.approvedThisMonth} tone="text-green-600" />
        <Stat label="Rejected" value={stats.rejected} tone="text-red-600" />
        <Stat label="Total applications" value={stats.total} />
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 pt-3 border-b border-gray-100">
          <div className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2 ${
                  tab === t.key ? "border-blue-brand text-blue-brand" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? "bg-blue-light text-blue-brand" : "bg-gray-100 text-gray-500"}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pb-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, email, city…"
                className="input py-2 pl-9 sm:w-64"
                aria-label="Search applications"
              />
            </div>
            <select value={type} onChange={e => setType(e.target.value as TypeFilter)} className="input py-2 sm:w-40" aria-label="Facility type">
              <option value="all">All types</option>
              <option value="lab">Laboratories</option>
              <option value="pharmacy">Pharmacies</option>
              <option value="hospital">Hospitals</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Building}
            title={tab === "open" && !query && type === "all" ? "No applications waiting" : "No matching applications"}
            description={tab === "open" && !query && type === "all" ? "New facility applications will appear here." : "Try a different tab, type or search."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const m = TYPE_META[a.facility_type] ?? { label: a.facility_type, icon: Building };
                  const Icon = m.icon;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/dashboard/facilities/${a.id}`} className="font-medium text-gray-900 hover:text-blue-brand">
                          {a.name}
                        </Link>
                        <p className="text-xs text-gray-400">{a.email}</p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Icon size={15} className="text-gray-400" aria-hidden /> {m.label}
                        </span>
                      </td>
                      <td className="text-gray-600">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="text-gray-600">
                        <p>{a.contact_person_name || "—"}</p>
                        <p className="text-xs text-gray-400">{a.phone}</p>
                      </td>
                      <td className="text-gray-500 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <StatusBadge status={a.status} />
                        {Array.isArray(a.doc_types) && (a.status === "pending" || a.status === "under_review") && (() => {
                          const missing = missingFacilityDocs(a.facility_type, a.doc_types).length;
                          return missing === 0 ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-green-700 whitespace-nowrap">
                              <FileCheck size={13} aria-hidden /> Documents complete
                            </p>
                          ) : (
                            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 whitespace-nowrap">
                              <FileClock size={13} aria-hidden /> Awaiting documents ({missing} missing)
                            </p>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {a.status === "pending" && (
                            <button
                              onClick={() => markUnderReview(a.id)}
                              disabled={markingId !== null}
                              className="btn-secondary px-2.5 py-1.5 text-xs whitespace-nowrap"
                            >
                              {markingId === a.id ? <Spinner className="w-3 h-3" /> : <Clock size={13} aria-hidden />}
                              Under review
                            </button>
                          )}
                          <Link href={`/dashboard/facilities/${a.id}`} className="btn-primary px-3 py-1.5 text-xs">
                            {a.status === "pending" || a.status === "under_review" ? "Review" : "View"}
                            <ChevronRight size={13} aria-hidden />
                          </Link>
                        </div>
                        {rowError && rowError.id === a.id && <p className="text-xs text-red-600 mt-1 text-right">{rowError.message}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
