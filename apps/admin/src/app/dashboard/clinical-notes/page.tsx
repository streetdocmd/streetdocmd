import { createAdminSupabase } from "@/lib/supabase-server";
import Link from "next/link";

export default async function ClinicalNotesPage({
  searchParams,
}: {
  searchParams: { provider?: string; diagnosis?: string };
}) {
  const admin = createAdminSupabase();

  let query = admin
    .from("clinical_notes")
    .select(`
      id, created_at, submitted_at, safeguarding_flag,
      providers(name),
      patient:users!patient_id(id, name),
      clinical_note_diagnoses(clinical_description, plain_language_diagnosis, diagnosis_type)
    `)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(100);

  const { data: notes } = await query;
  const list = notes ?? [];

  // Filter in-memory for simplicity
  const filtered = list.filter((n: any) => {
    if (searchParams.provider) {
      const prov = (n.providers?.name ?? "").toLowerCase();
      if (!prov.includes(searchParams.provider.toLowerCase())) return false;
    }
    if (searchParams.diagnosis) {
      const dx = n.clinical_note_diagnoses?.map((d: any) => d.clinical_description + " " + d.plain_language_diagnosis).join(" ").toLowerCase() ?? "";
      if (!dx.includes(searchParams.diagnosis.toLowerCase())) return false;
    }
    return true;
  });

  function wasRushed(note: any) {
    if (!note.submitted_at || !note.created_at) return false;
    const mins = (new Date(note.submitted_at).getTime() - new Date(note.created_at).getTime()) / 60000;
    return mins < 5;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} submitted note{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/clinical-notes/uncodified" className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">
            Uncodified Diagnoses →
          </Link>
          <Link href="/dashboard/clinical-notes/catalogue" className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">
            Catalogue →
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 flex-wrap">
        <input
          name="provider"
          defaultValue={searchParams.provider ?? ""}
          placeholder="Search by provider name..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <input
          name="diagnosis"
          defaultValue={searchParams.diagnosis ?? ""}
          placeholder="Search by diagnosis..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Filter
        </button>
        {(searchParams.provider || searchParams.diagnosis) && (
          <Link href="/dashboard/clinical-notes" className="text-sm text-gray-500 px-4 py-2 hover:underline">Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Date", "Patient", "Provider", "Primary Diagnosis", "Submitted", "Flags", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No submitted clinical notes found</td></tr>
              ) : filtered.map((note: any) => {
                const primaryDx = note.clinical_note_diagnoses?.find((d: any) => d.diagnosis_type === "primary");
                const rushed = wasRushed(note);
                const patientDisplay = note.patient?.id ? `PT-${note.patient.id.slice(0, 6).toUpperCase()}` : "—";

                return (
                  <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {note.created_at ? new Date(note.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{patientDisplay}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{note.providers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {primaryDx?.plain_language_diagnosis || primaryDx?.clinical_description || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {note.submitted_at ? new Date(note.submitted_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {note.safeguarding_flag && (
                          <span title="Safeguarding concern" className="text-base">🔴</span>
                        )}
                        {rushed && (
                          <span title="Submitted in under 5 minutes" className="text-base">⚠️</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clinical-notes/${note.id}`}
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 font-medium hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        View Full Note
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
