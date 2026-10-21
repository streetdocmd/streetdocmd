import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, CreditCard } from "lucide-react";
import ComingSoonBadge from "@/components/ComingSoonBadge";
import { createServerSupabase } from "@/lib/supabase-server";
import PrivacyPolicyLink from "@/components/PrivacyPolicyLink";
import FamilyMembersSection from "./FamilyMembersSection";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("users").select("*").eq("id", user!.id).single();
  const { data: familyMembers } = await supabase
    .from("family_members")
    .select("id, name, relationship")
    .order("created_at", { ascending: true });

  if (!p) redirect("/register?complete=1");

  const dobLabel = p.dob
    ? new Date(`${p.dob}T00:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : "Not set";
  const genderLabel = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "Not set";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link href="/dashboard/profile/edit" className="btn-primary shrink-0">Edit profile</Link>
      </div>

      <div className="card p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-brand flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {p.name?.[0] ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg text-gray-900">{p.name}</p>
          <p className="text-sm text-gray-500 truncate">{p.email ?? user!.email}</p>
          <p className="text-sm text-gray-500">{p.phone}</p>
        </div>
      </div>

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Medical Information</h2>
        <dl className="space-y-3">
          <Row label="Date of Birth" value={dobLabel} />
          <Row label="Gender" value={genderLabel} />
          <Row label="Blood Group" value={p.blood_group ?? "Not set"} />
          <Row label="Known Conditions" value={p.known_conditions?.join(", ") || "None recorded"} />
          <Row label="Allergies" value={p.allergies?.join(", ") || "None recorded"} />
          <Row label="Current Medications" value={p.current_medications?.join(", ") || "None recorded"} />
        </dl>
      </div>

      <FamilyMembersSection initialMembers={familyMembers ?? []} />

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Emergency Contact</h2>
        {p.emergency_contact_name ? (
          <dl className="space-y-3">
            <Row label="Name" value={p.emergency_contact_name} />
            <Row label="Phone" value={p.emergency_contact_phone ?? "Not set"} />
            <Row label="Relationship" value={p.emergency_contact_relationship ?? "Not set"} />
          </dl>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">No emergency contact added yet.</p>
            <Link href="/dashboard/profile/edit" className="text-sm font-medium text-blue-brand hover:underline shrink-0">Add contact</Link>
          </div>
        )}
      </div>

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Account</h2>
        {[
          { icon: MapPin, label: "Saved addresses" },
          { icon: CreditCard, label: "Saved payment methods" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} aria-disabled="true" className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 opacity-70">
            <span className="flex items-center gap-2.5 text-sm text-gray-600">
              <Icon size={16} className="text-gray-400" /> {label}
            </span>
            <ComingSoonBadge />
          </div>
        ))}
      </div>

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
    <div className="flex justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right max-w-[60%] sm:max-w-xs break-words">{value}</dd>
    </div>
  );
}