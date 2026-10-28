import { redirect } from "next/navigation";
import { BadgeCheck, FileText, ShieldCheck, GraduationCap, Star, Users } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { VERIFICATION_STATUS_LABELS, PROVIDER_AGREEMENT_TITLE } from "@streetdocmd/shared";
import { DOC_LABELS, hasCurrentAgreement } from "@/lib/onboarding";
import { ComingSoonItem } from "@/components/ComingSoonBadge";
import AgreementAcceptCard from "@/components/AgreementAcceptCard";
import EditProfileForm from "./EditProfileForm";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*"): tolerate a database without migration 046's agreement columns
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!provider) return null;

  const { data: docs } = await supabase
    .from("provider_documents")
    .select("id, document_type, uploaded_at")
    .eq("provider_id", provider.id)
    .order("uploaded_at", { ascending: false });

  const verified = provider.verification_status === "verified";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy tracking-tight">Profile</h1>
        <p className="text-sm text-muted mt-0.5">How patients see you, when you work, and where your payouts go.</p>
      </div>

      {/* Identity card */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-white shrink-0">
            {(provider.name as string).replace(/^(dr|mr|mrs|ms|nurse)\.?\s+/i, "").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-ds-xl font-bold text-navy">{provider.name}</h2>
              <span className={`badge inline-flex items-center gap-1 ${
                verified ? "bg-green-100 text-green-700" :
                provider.verification_status === "rejected" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {verified && <BadgeCheck size={13} />}
                {(VERIFICATION_STATUS_LABELS as Record<string, string>)[provider.verification_status]}
              </span>
            </div>
            <p className="text-muted text-sm mt-0.5">
              {provider.specialty}{provider.specialist_field ? ` — ${provider.specialist_field}` : ""}
            </p>
            <p className="text-muted text-xs mt-0.5">{provider.credentials}</p>
            {provider.license_number && (
              <p className="text-xs text-muted mt-0.5">{provider.license_body}: {provider.license_number}</p>
            )}
          </div>
          <div className="flex gap-6 sm:text-right">
            <div>
              <p className="font-bold text-ink inline-flex items-center gap-1">
                <Star size={14} className="text-amber-500" />
                {provider.rating > 0 ? Number(provider.rating).toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted">Rating</p>
            </div>
            <div>
              <p className="font-bold text-ink inline-flex items-center gap-1">
                <Users size={14} className="text-accent" />
                {provider.total_visits ?? 0}
              </p>
              <p className="text-xs text-muted">Visits</p>
            </div>
          </div>
        </div>
      </div>

      {!hasCurrentAgreement(provider.agreement_version) && (
        <AgreementAcceptCard updated={!!provider.agreement_version} />
      )}

      {/* Editable details */}
      <EditProfileForm
        profile={{
          providerId: provider.id,
          bio: provider.bio,
          languages: provider.languages,
          years_experience: provider.years_experience,
          service_radius_km: provider.service_radius_km,
          working_hours_start: provider.working_hours_start,
          working_hours_end: provider.working_hours_end,
          bank_name: provider.bank_name,
          bank_account_number: provider.bank_account_number,
          bank_account_name: provider.bank_account_name,
        }}
      />

      {/* Credentials & agreement */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink mb-1">Credentials on file</h3>
        <p className="text-xs text-muted mb-3">
          Verified by the StreetdocMD team. To update a licence (for example on renewal), email{" "}
          <a href="mailto:contact@streetdocmd.com" className="text-accent hover:underline">contact@streetdocmd.com</a>.
        </p>
        {(docs ?? []).length === 0 ? (
          <p className="text-sm text-muted py-2">No documents on file.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(docs ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-ink min-w-0">
                  <FileText size={16} className="text-muted shrink-0" />
                  <span className="truncate">{DOC_LABELS[d.document_type] ?? d.document_type}</span>
                </span>
                <span className="text-xs text-muted shrink-0">
                  {new Date(d.uploaded_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {provider.agreement_accepted_at && (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2 text-xs text-muted">
            <ShieldCheck size={15} className="text-green-600 shrink-0" />
            {PROVIDER_AGREEMENT_TITLE} v{provider.agreement_version} accepted{" "}
            {new Date(provider.agreement_accepted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ComingSoonItem
          icon={ShieldCheck}
          title="Indemnity insurance"
          description="Upload your professional indemnity cover and get renewal reminders (agreement clause 6)."
        />
        <ComingSoonItem
          icon={GraduationCap}
          title="Training & CPD records"
          description="Keep your CPD points and training certificates in one place for licence renewal."
        />
      </div>
    </div>
  );
}
