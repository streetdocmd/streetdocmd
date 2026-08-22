import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { VERIFICATION_STATUS_LABELS } from "@streetdocmd/shared";
import EditProfileForm from "./EditProfileForm";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, specialty, specialist_field, credentials, license_body, license_number, rating, total_visits, verification_status, bio, languages, years_experience, service_radius_km, working_hours_start, working_hours_end, bank_name, bank_account_number, bank_account_name")
    .eq("user_id", user.id)
    .single();
  if (!provider) return null;

  const { data: docs } = await supabase
    .from("provider_documents")
    .select("id, document_type, uploaded_at")
    .eq("provider_id", provider.id)
    .order("uploaded_at", { ascending: false });

  const DOC_LABELS: Record<string, string> = {
    certificate: "University Certificate",
    mdcn_licence: "MDCN Licence",
    nmcn_licence: "NMCN Licence",
    mrtb_licence: "MRTB Licence",
    mlscn_licence: "MLSCN Licence",
    nin: "NIN",
    passport: "Passport",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* Identity card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{provider.name}</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {provider.specialty}{provider.specialist_field ? ` — ${provider.specialist_field}` : ""}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{provider.credentials}</p>
            {provider.license_number && (
              <p className="text-xs text-gray-400 mt-0.5">{provider.license_body}: {provider.license_number}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className={`badge ${
              provider.verification_status === "verified" ? "bg-green-100 text-green-700" :
              provider.verification_status === "rejected" ? "bg-red-100 text-red-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {(VERIFICATION_STATUS_LABELS as Record<string, string>)[provider.verification_status]}
            </span>
            <div className="flex gap-3 mt-3 text-center">
              <div>
                <p className="font-bold text-gray-900">{provider.rating > 0 ? provider.rating.toFixed(1) : "—"}</p>
                <p className="text-xs text-gray-400">Rating</p>
              </div>
              <div>
                <p className="font-bold text-gray-900">{provider.total_visits}</p>
                <p className="text-xs text-gray-400">Visits</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Uploaded credentials</h3>
        {(docs ?? []).length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            <Link href="/onboarding/documents" className="btn-primary inline-flex mt-3 text-sm">
              Upload documents
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(docs ?? []).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  <span className="text-sm font-medium text-gray-700">{DOC_LABELS[d.document_type] ?? d.document_type}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(d.uploaded_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit form */}
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
    </div>
  );
}