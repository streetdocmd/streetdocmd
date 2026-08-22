"use client";
import { useState } from "react";
import Link from "next/link";

export default function SafeguardingClient({ alerts, unresolvedCount }: { alerts: any[]; unresolvedCount: number }) {
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [localAlerts, setLocalAlerts] = useState(alerts);

  const displayed = showResolved ? localAlerts : localAlerts.filter(a => !a.resolved);

  async function resolve(alertId: string) {
    setResolving(alertId);
    const res = await fetch(`/api/safeguarding/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true, notes: notes[alertId] ?? "" }),
    });
    setResolving(null);
    if (res.ok) {
      setLocalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a));
    }
  }

  function patientAge(dob: string | null): string {
    if (!dob) return "—";
    return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safeguarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Flagged clinical encounters — admin only</p>
        </div>
        {unresolvedCount > 0 && (
          <span className="bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {/* Warning banner */}
      <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl">
        🔒 Safeguarding alerts are strictly confidential. This page is visible to admin only and must never be shared with patients, providers, or facility portals.
      </div>

      {/* Filter toggle */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowResolved(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium ${!showResolved ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Unresolved ({localAlerts.filter(a => !a.resolved).length})
        </button>
        <button onClick={() => setShowResolved(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium ${showResolved ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          All alerts ({localAlerts.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-gray-700">No {showResolved ? "" : "unresolved "}safeguarding alerts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map(alert => {
            const patient = alert.users as any;
            const provider = alert.providers as any;
            const note = alert.clinical_notes as any;
            return (
              <div key={alert.id} className={`card p-5 space-y-4 ${!alert.resolved ? "border-l-4 border-l-red-500" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {alert.resolved ? (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Resolved</span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Action Required</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(alert.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {patient?.name ?? "Unknown Patient"}, {patientAge(patient?.date_of_birth)} yrs
                    </p>
                    <p className="text-sm text-gray-500">Phone: {patient?.phone ?? "—"}</p>
                    <p className="text-sm text-gray-500">Flagged by: Dr {provider?.name ?? "Unknown"}</p>
                    {note?.booking_id && (
                      <Link href={`/dashboard/bookings/${note.booking_id}`}
                        className="text-xs text-teal-brand hover:underline font-medium">
                        View booking →
                      </Link>
                    )}
                  </div>
                </div>

                {!alert.resolved && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-600 block">Resolution notes</label>
                    <textarea
                      rows={2}
                      value={notes[alert.id] ?? ""}
                      onChange={e => setNotes(n => ({ ...n, [alert.id]: e.target.value }))}
                      placeholder="Document the action taken…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                    <button
                      onClick={() => resolve(alert.id)}
                      disabled={resolving === alert.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {resolving === alert.id ? "Resolving…" : "Mark Resolved"}
                    </button>
                  </div>
                )}

                {alert.resolved && alert.resolved_at && (
                  <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                    Resolved {new Date(alert.resolved_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
