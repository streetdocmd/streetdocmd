import { createAdminSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Image from "next/image";
import VerificationActions from "./VerificationActions";

const DOC_LABELS: Record<string, string> = {
  mdcn_licence: "MDCN Licence",
  nmcn_licence: "NMCN Licence",
  mrtb_licence: "MRTB Licence",
  mlscn_licence: "MLSCN Licence",
  nin: "NIN",
  passport: "Passport Photo",
  certificate: "Certificate",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const LOG_ACTION_STYLES: Record<string, string> = {
  approved: "text-green-700 bg-green-50",
  rejected: "text-red-700 bg-red-50",
  reinstated: "text-blue-700 bg-blue-50",
  suspended: "text-orange-700 bg-orange-50",
};

function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
}

// provider_documents.file_url holds a bare storage path for documents
// uploaded since the provider-docs bucket became private. Older rows still
// hold a full public-URL string from before that change — extract the path
// portion from either shape so a signed URL can be generated consistently.
function providerDocPath(fileUrl: string) {
  const marker = "/storage/v1/object/public/provider-docs/";
  const idx = fileUrl.indexOf(marker);
  return idx >= 0 ? fileUrl.slice(idx + marker.length) : fileUrl;
}

export default async function ProviderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();

  const [{ data: provider }, { data: logs }] = await Promise.all([
    supabase
      .from("providers")
      .select("*, users(email), provider_documents(*)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("verification_logs")
      .select("id, action, notes, created_at, users(name)")
      .eq("provider_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!provider) redirect("/dashboard/providers");

  const rawDocs = (provider.provider_documents ?? []) as {
    id: string; document_type: string; file_url: string; uploaded_at: string;
  }[];

  // provider-docs is a private bucket (credential documents) — resolve each
  // file to a short-lived signed URL rather than linking to it directly.
  const docs = await Promise.all(
    rawDocs.map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("provider-docs")
        .createSignedUrl(providerDocPath(doc.file_url), 600);
      return { ...doc, viewUrl: signed?.signedUrl ?? null };
    })
  );

  type VerifyLog = {
    id: string; action: string; notes: string | null; created_at: string;
    users: { name: string }[] | null;
  };
  const verifyLogs = (logs ?? []) as unknown as VerifyLog[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/dashboard/providers" className="text-gray-400 hover:text-gray-600 text-sm">
          ← All providers
        </a>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Provider Review</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_STYLES[provider.verification_status] ?? ""}`}>
          {provider.verification_status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          {provider.photo_url ? (
            <Image
              src={provider.photo_url}
              alt={provider.name}
              width={72}
              height={72}
              className="rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {provider.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{provider.name}</h2>
            <p className="text-gray-600">
              {provider.specialty}{provider.specialist_field ? ` — ${provider.specialist_field}` : ""} · {provider.credentials}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">{provider.years_experience} yr{provider.years_experience !== 1 ? "s" : ""} experience</p>
            <div className="flex flex-wrap gap-4 mt-2">
              {provider.license_number && (
                <p className="text-sm text-gray-600">{provider.license_body}: <strong>{provider.license_number}</strong></p>
              )}
              {(provider.users as any)?.email && (
                <p className="text-sm text-gray-500">{(provider.users as any).email}</p>
              )}
            </div>
            {provider.phone && (
              <p className="text-sm text-gray-500 mt-0.5">📞 {provider.phone}</p>
            )}
          </div>
        </div>
        {provider.bio && (
          <p className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4 leading-relaxed">
            {provider.bio}
          </p>
        )}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-sm text-gray-500">
          <span>⭐ {provider.rating > 0 ? provider.rating : "No ratings yet"}</span>
          <span>🏥 {provider.total_visits} visit{provider.total_visits !== 1 ? "s" : ""}</span>
          <span>Joined {new Date(provider.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* Rejection reason (if previously rejected) */}
      {provider.rejection_reason && provider.verification_status === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">Previous rejection reason:</p>
          <p className="text-sm text-red-600">{provider.rejection_reason}</p>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">
          Uploaded Documents
          <span className="ml-2 text-xs font-normal text-gray-400">({docs.length} file{docs.length !== 1 ? "s" : ""})</span>
        </h3>

        {docs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-2xl mb-2">📄</p>
            <p className="text-sm">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {docs.map((doc) => (
              <div key={doc.id} className="border border-gray-100 rounded-xl overflow-hidden">
                {/* Image preview */}
                {!doc.viewUrl ? (
                  <div className="flex items-center justify-center h-40 bg-gray-50">
                    <div className="text-center">
                      <p className="text-4xl mb-2">⚠️</p>
                      <p className="text-sm text-gray-400 font-medium">Preview unavailable</p>
                    </div>
                  </div>
                ) : isImage(doc.file_url) ? (
                  <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer">
                    <div className="relative h-40 bg-gray-50">
                      <Image
                        src={doc.viewUrl}
                        alt={DOC_LABELS[doc.document_type] ?? doc.document_type}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </a>
                ) : (
                  <a
                    href={doc.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-40 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-center">
                      <p className="text-4xl mb-2">📄</p>
                      <p className="text-sm text-blue-600 font-medium">Open document</p>
                    </div>
                  </a>
                )}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {DOC_LABELS[doc.document_type] ?? doc.document_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400">
                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {doc.viewUrl && (
                    <a
                      href={doc.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Full size ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification actions */}
      <VerificationActions
        providerId={provider.id}
        currentStatus={provider.verification_status as any}
      />

      {/* Verification history */}
      {verifyLogs.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Verification History</h3>
          <div className="space-y-3">
            {verifyLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize shrink-0 mt-0.5 ${LOG_ACTION_STYLES[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    by <strong>{(log.users as {name:string}[]|null)?.[0]?.name ?? "Admin"}</strong> · {new Date(log.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {log.notes && (
                    <p className="text-sm text-gray-600 mt-0.5 italic">"{log.notes}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}