import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function ProviderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: provider } = await supabase
    .from("providers")
    .select("*, provider_documents(*)")
    .eq("id", params.id)
    .single();

  if (!provider) redirect("/dashboard/providers");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/dashboard/providers" className="text-gray-400 hover:text-gray-600">← Back</a>
        <h1 className="text-2xl font-bold text-gray-900">Provider Review</h1>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          {provider.photo_url ? (
            <Image
              src={provider.photo_url}
              alt={provider.name}
              width={72}
              height={72}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-18 h-18 rounded-full bg-brand-blue flex items-center justify-center text-white text-2xl font-bold">
              {provider.name[0]}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{provider.name}</h2>
            <p className="text-gray-600">{provider.specialty} · {provider.credentials}</p>
            <p className="text-sm text-gray-400 mt-0.5">{provider.years_experience} years experience</p>
            {provider.mdcn_number && (
              <p className="text-sm text-gray-600 mt-1">MDCN: <strong>{provider.mdcn_number}</strong></p>
            )}
            {provider.nmcn_number && (
              <p className="text-sm text-gray-600">NMCN: <strong>{provider.nmcn_number}</strong></p>
            )}
          </div>
        </div>
        {provider.bio && (
          <p className="mt-4 text-sm text-gray-600 border-t pt-4">{provider.bio}</p>
        )}
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Uploaded Documents</h3>
        {(provider.provider_documents ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No documents uploaded yet</p>
        ) : (
          <ul className="space-y-2">
            {provider.provider_documents.map((doc: { id: string; document_type: string; file_url: string; uploaded_at: string }) => (
              <li key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium capitalize text-gray-900">
                    {doc.document_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.uploaded_at).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-blue hover:underline"
                >
                  View →
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Verification Actions */}
      {provider.verification_status !== "verified" && (
        <VerificationActions providerId={provider.id} currentStatus={provider.verification_status} />
      )}

      {provider.verification_status === "verified" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm font-medium">
          ✓ This provider is verified and active on the platform.
        </div>
      )}

      {provider.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">Rejection reason:</p>
          <p className="text-sm text-red-600 mt-1">{provider.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}

function VerificationActions({ providerId, currentStatus }: { providerId: string; currentStatus: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-4">Verification Decision</h3>
      <div className="flex gap-3">
        <form action={`/api/providers/${providerId}/verify`} method="POST">
          <input type="hidden" name="action" value="approve" />
          <button type="submit" className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            Approve & Issue Badge
          </button>
        </form>
        <form action={`/api/providers/${providerId}/verify`} method="POST">
          <input type="hidden" name="action" value="reject" />
          <button type="submit" className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
            Reject
          </button>
        </form>
        {currentStatus !== "under_review" && (
          <form action={`/api/providers/${providerId}/verify`} method="POST">
            <input type="hidden" name="action" value="under_review" />
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Mark Under Review
            </button>
          </form>
        )}
      </div>
    </div>
  );
}