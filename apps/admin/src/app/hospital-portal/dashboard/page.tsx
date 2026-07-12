"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const URGENCY_COLOR: Record<string, string> = {
  emergency: "bg-red-100 text-red-700",
  urgent:    "bg-amber-100 text-amber-700",
  routine:   "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending:      "New",
  acknowledged: "Acknowledged",
  in_progress:  "In Progress",
  completed:    "Completed",
  cancelled:    "Cancelled",
};

type Tab = "new" | "in_progress" | "history" | "profile";

interface Referral {
  id: string;
  status: string;
  urgency: string;
  reason: string;
  clinical_summary: string;
  referred_at: string;
  pdf_url: string | null;
  patient_id: string;
  providers: { name: string } | null;
  // populated after fetch
  patientFirstName?: string;
  patientAge?: string;
  patientFullName?: string;
}

interface HospitalProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  hospital_level: string;
  emergency_available: boolean;
  ambulance_available: boolean;
  bed_count: number | null;
  specialties: string[];
  active: boolean;
}

export default function HospitalPortalDashboard() {
  const [tab, setTab] = useState<Tab>("new");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hospitalPartnerId, setHospitalPartnerId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/hospital-portal/login"; return; }

    const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!userProfile || !["hospital_staff", "admin"].includes(userProfile.role)) {
      window.location.href = "/hospital-portal/login";
      return;
    }

    let partnerId: string | null = null;
    if (userProfile.role === "hospital_staff") {
      const { data: staff } = await supabase.from("hospital_staff").select("hospital_partner_id").eq("user_id", user.id).single();
      partnerId = staff?.hospital_partner_id ?? null;
    }
    setHospitalPartnerId(partnerId);

    if (partnerId) {
      // Rule 6: no access unless active = true
      const { data: hosp } = await supabase.from("hospital_partners").select("*").eq("id", partnerId).single();
      if (!hosp?.active) {
        setLoading(false);
        setProfile(hosp);
        return;
      }
      setProfile(hosp as HospitalProfile);
    }

    await loadReferrals(partnerId, supabase);

    // Real-time subscription
    const channel = supabase
      .channel("hospital-portal-referrals")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "hospital_referrals",
        ...(partnerId ? { filter: `hospital_partner_id=eq.${partnerId}` } : {}),
      }, () => loadReferrals(partnerId, supabase))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  async function loadReferrals(partnerId: string | null, supabase: ReturnType<typeof createClient>) {
    let query = supabase
      .from("hospital_referrals")
      .select(`id, status, urgency, reason, clinical_summary, referred_at, pdf_url, patient_id, providers(name)`)
      .order("referred_at", { ascending: false });

    if (partnerId) query = query.eq("hospital_partner_id", partnerId);

    const { data } = await query;
    const rows = (data ?? []) as Referral[];

    // Fetch patient info — privacy rule: first name + age only until acknowledged
    const patientIds = [...new Set(rows.map(r => r.patient_id))];
    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from("users")
        .select("id, name, date_of_birth")
        .in("id", patientIds);

      const patientMap = Object.fromEntries((patients ?? []).map(p => {
        const dob = p.date_of_birth ? new Date(p.date_of_birth) : null;
        const age = dob ? String(Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))) : "—";
        const firstName = (p.name ?? "").split(" ")[0];
        return [p.id, { firstName, age, fullName: p.name }];
      }));

      rows.forEach(r => {
        const p = patientMap[r.patient_id];
        if (p) {
          r.patientFirstName = p.firstName;
          r.patientAge = p.age;
          // Only reveal full name after hospital has accepted (acknowledged or beyond)
          r.patientFullName = ["acknowledged", "in_progress", "completed"].includes(r.status)
            ? p.fullName
            : undefined;
        }
      });
    }

    setReferrals(rows);
    setLoading(false);
  }

  async function updateStatus(referralId: string, newStatus: string) {
    setUpdating(referralId);
    const supabase = createClient();
    await supabase.from("hospital_referrals").update({ status: newStatus }).eq("id", referralId);
    await loadReferrals(hospitalPartnerId, supabase);
    setUpdating(null);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/hospital-portal/login";
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full" /></div>;
  }

  // Rule 6: block inactive facilities
  if (profile && !profile.active) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="font-semibold text-gray-700">Portal Inactive</p>
        <p className="text-gray-400 text-sm mt-1">Your facility account is not active. Please contact StreetdocMD support.</p>
        <button onClick={signOut} className="mt-4 text-sm text-red-600 hover:underline">Sign out</button>
      </div>
    );
  }

  const newReferrals      = referrals.filter(r => r.status === "pending");
  const inProgressRefs    = referrals.filter(r => ["acknowledged", "in_progress"].includes(r.status));
  const historyRefs       = referrals.filter(r => ["completed", "cancelled"].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.name ?? "Hospital"} Portal</h1>
          <p className="text-sm text-gray-500 mt-0.5">StreetdocMD referral management</p>
        </div>
        <div className="flex items-center gap-3">
          {newReferrals.length > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {newReferrals.length} new
            </span>
          )}
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-700">Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["new",         `New Referrals (${newReferrals.length})`],
          ["in_progress", `In Progress (${inProgressRefs.length})`],
          ["history",     "History"],
          ["profile",     "Profile"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* New Referrals */}
      {tab === "new" && (
        <ReferralList
          referrals={newReferrals}
          updating={updating}
          primaryAction={{ label: "Acknowledge", nextStatus: "acknowledged" }}
          onStatusUpdate={updateStatus}
        />
      )}

      {/* In Progress */}
      {tab === "in_progress" && (
        <ReferralList
          referrals={inProgressRefs}
          updating={updating}
          primaryAction={{ label: "Mark Completed", nextStatus: "completed" }}
          secondaryAction={{ label: "Patient Arrived", nextStatus: "in_progress" }}
          onStatusUpdate={updateStatus}
        />
      )}

      {/* History */}
      {tab === "history" && (
        historyRefs.length === 0
          ? <EmptyState icon="📋" message="No completed referrals yet" />
          : <div className="space-y-3">
              {historyRefs.map(r => <ReferralCard key={r.id} referral={r} />)}
            </div>
      )}

      {/* Profile */}
      {tab === "profile" && profile && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">{profile.name}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Row label="Address"        value={profile.address} />
            <Row label="Phone"          value={profile.phone} />
            <Row label="Email"          value={profile.email} />
            <Row label="Level"          value={profile.hospital_level?.replace("_", " ") ?? "—"} />
            <Row label="Emergency Dept" value={profile.emergency_available ? "Available" : "Not available"} />
            <Row label="Ambulance"      value={profile.ambulance_available ? "Available" : "Not available"} />
            <Row label="Bed count"      value={profile.bed_count ? String(profile.bed_count) : "—"} />
          </div>
          {Array.isArray(profile.specialties) && profile.specialties.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map(s => (
                  <span key={s} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferralList({ referrals, updating, primaryAction, secondaryAction, onStatusUpdate }: {
  referrals: Referral[];
  updating: string | null;
  primaryAction: { label: string; nextStatus: string };
  secondaryAction?: { label: string; nextStatus: string };
  onStatusUpdate: (id: string, status: string) => void;
}) {
  if (referrals.length === 0) {
    return <EmptyState icon="✅" message="No referrals in this category" />;
  }
  return (
    <div className="space-y-4">
      {referrals.map(r => (
        <div key={r.id} className="card p-5 space-y-3">
          <ReferralCard referral={r} />
          <div className="flex gap-2 pt-1">
            {secondaryAction && r.status === "acknowledged" && (
              <button
                onClick={() => onStatusUpdate(r.id, secondaryAction.nextStatus)}
                disabled={updating === r.id}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                {updating === r.id ? "…" : secondaryAction.label}
              </button>
            )}
            <button
              onClick={() => onStatusUpdate(r.id, primaryAction.nextStatus)}
              disabled={updating === r.id}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              {updating === r.id ? "Updating…" : primaryAction.label}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReferralCard({ referral: r }: { referral: Referral }) {
  const patientDisplay = r.patientFullName
    ? `${r.patientFullName}, ${r.patientAge} yrs`
    : `${r.patientFirstName ?? "Patient"}, ${r.patientAge ?? "—"} yrs`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${URGENCY_COLOR[r.urgency] ?? "bg-gray-100 text-gray-600"}`}>
          {r.urgency}
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(r.referred_at ?? "").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="font-semibold text-gray-900">{patientDisplay}</p>
      {r.providers && <p className="text-sm text-gray-500">Referred by Dr {(r.providers as any).name}</p>}
      {r.reason && <p className="text-sm text-gray-700"><span className="font-medium">Reason:</span> {r.reason}</p>}
      {r.patientFullName && r.clinical_summary && (
        <p className="text-sm text-gray-500 italic">{r.clinical_summary}</p>
      )}
      {r.pdf_url && (
        <a href={r.pdf_url} target="_blank" rel="noreferrer"
          className="inline-block text-xs text-red-600 hover:underline font-medium">
          View Referral Letter
        </a>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-gray-800 mt-0.5">{value || "—"}</p>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-semibold text-gray-700">{message}</p>
      <p className="text-gray-400 text-sm mt-1">New referrals will appear here in real time.</p>
    </div>
  );
}
