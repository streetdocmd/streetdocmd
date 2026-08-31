import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import PrivacyPolicyLink from "@/components/PrivacyPolicyLink";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("users").select("*").eq("id", user!.id).single();

  if (!p) return null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link href="/dashboard/profile/edit" className="btn-primary">Edit Medical Info</Link>
      </div>

      <div className="card p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-brand flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {p.name?.[0] ?? "?"}
        </div>
        <div>
          <p className="font-bold text-lg text-gray-900">{p.name}</p>
          <p className="text-sm text-gray-500">{p.email ?? user!.email}</p>
          <p className="text-sm text-gray-500">{p.phone}</p>
        </div>
      </div>

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Medical Information</h2>
        <dl className="space-y-3">
          <Row label="Blood Group" value={p.blood_group ?? "Not set"} />
          <Row label="Known Conditions" value={p.known_conditions?.join(", ") || "None recorded"} />
          <Row label="Allergies" value={p.allergies?.join(", ") || "None recorded"} />
          <Row label="Current Medications" value={p.current_medications?.join(", ") || "None recorded"} />
        </dl>
      </div>

      {p.emergency_contact_name && (
        <div className="card p-6 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Emergency Contact</h2>
          <dl className="space-y-3">
            <Row label="Name" value={p.emergency_contact_name} />
            <Row label="Phone" value={p.emergency_contact_phone} />
            <Row label="Relationship" value={p.emergency_contact_relationship} />
          </dl>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Legal</h2>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-gray-700">Privacy Policy</span>
          <PrivacyPolicyLink>View →</PrivacyPolicyLink>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right max-w-xs">{value}</dd>
    </div>
  );
}