export const dynamic = "force-dynamic";

import { createAdminSupabase } from "@/lib/supabase-server";
import { AcknowledgeResolve, AddContactForm, ToggleContact, DeleteContact } from "./EmergencyActions";

const STATUS_STYLES: Record<string, string> = {
  active:       "bg-red-100 text-red-700 border border-red-200",
  acknowledged: "bg-blue-100 text-blue-700 border border-blue-200",
  resolved:     "bg-green-100 text-green-700 border border-green-200",
};

type PatientInfo = { name: string | null; phone: string | null };

type Emergency = {
  id: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  status: string;
  created_at: string;
  patient: PatientInfo[] | null;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  role: string;
  is_active: boolean;
};

function elapsed(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function EmergencyRow({ e }: { e: Emergency }) {
  const patient = e.patient?.[0];
  const mapsUrl = e.lat && e.lng ? `https://maps.google.com/?q=${e.lat},${e.lng}` : null;
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border flex items-start justify-between gap-4 ${e.status === "active" ? "border-red-300" : "border-gray-100"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${STATUS_STYLES[e.status] ?? ""}`}>
            {e.status}
          </span>
          <span className="text-xs text-gray-400">{elapsed(e.created_at)}</span>
        </div>
        <p className="font-semibold text-gray-900 mt-1">{patient?.name ?? "Unknown patient"}</p>
        {patient?.phone && (
          <a href={`tel:${patient.phone}`} className="text-sm text-blue-brand hover:underline">
            {patient.phone}
          </a>
        )}
        {e.address && <p className="text-xs text-gray-400 mt-0.5">{e.address}</p>}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
            Open in Maps ↗
          </a>
        )}
      </div>
      <div className="shrink-0">
        <AcknowledgeResolve id={e.id} status={e.status} />
      </div>
    </div>
  );
}

export default async function EmergenciesPage() {
  const supabase = createAdminSupabase();

  const [{ data: rawEmergencies }, { data: rawContacts }] = await Promise.all([
    supabase
      .from("emergencies")
      .select("id, lat, lng, address, status, created_at, patient:users!patient_id(name, phone)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("emergency_contacts")
      .select("id, name, phone, role, is_active")
      .order("created_at", { ascending: true }),
  ]);

  const emergencies = (rawEmergencies ?? []) as unknown as Emergency[];
  const contacts    = (rawContacts    ?? []) as unknown as Contact[];

  const active       = emergencies.filter(e => e.status === "active");
  const acknowledged = emergencies.filter(e => e.status === "acknowledged");
  const resolved     = emergencies.filter(e => e.status === "resolved");

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Emergency Alerts</h1>

      {/* Active */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Active <span className="text-red-600">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-sm">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-semibold text-gray-700">No active emergencies</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(e => <EmergencyRow key={e.id} e={e} />)}
          </div>
        )}
      </section>

      {/* Acknowledged */}
      {acknowledged.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Acknowledged ({acknowledged.length})
          </h2>
          <div className="space-y-2">
            {acknowledged.map(e => <EmergencyRow key={e.id} e={e} />)}
          </div>
        </section>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map(e => <EmergencyRow key={e.id} e={e} />)}
          </div>
        </section>
      )}

      {/* Emergency contacts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Emergency Contacts
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {contacts.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {contacts.map(c => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone} · <span className="capitalize">{c.role}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ToggleContact id={c.id} isActive={c.is_active} />
                    <DeleteContact id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 mb-3">Add responder</p>
            <AddContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
