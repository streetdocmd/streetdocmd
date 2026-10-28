import { redirect } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { hasCurrentAgreement, onboardingRoute } from "@/lib/onboarding";
import OnboardingSteps from "@/components/OnboardingSteps";
import DocumentUploadForm from "./DocumentUploadForm";

export default async function DocumentsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // select("*"): tolerate a database without migration 046's agreement columns
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) redirect("/register/individual");

  // select("*"): review_status arrives with migration 062
  const { data: existingDocs } = await supabase
    .from("provider_documents")
    .select("*")
    .eq("provider_id", provider.id)
    .order("uploaded_at", { ascending: false });
  const uploadedTypes = Array.from(new Set((existingDocs ?? []).map(d => d.document_type as string)));
  // A document the reviewer flagged (latest upload of its type) needs uploading again
  const hasFlagged = uploadedTypes.some(t => (existingDocs ?? []).find(d => d.document_type === t)?.review_status === "needs_info");

  // Verified / under review / a complete pending application have nothing to
  // do here. A rejected provider is re-applying and does need the form, and so
  // does anyone with a flagged document.
  const isRejected = provider.verification_status === "rejected";
  if (!isRejected && !hasFlagged) {
    const target = onboardingRoute(provider, uploadedTypes);
    if (target !== "/onboarding/documents") redirect(target);
  }

  return (
    <div>
      <div className="mb-8">
        <OnboardingSteps current={1} />
      </div>

      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-accent-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileCheck2 size={26} className="text-accent" />
        </div>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">
          {isRejected ? "Update your documents" : "Upload your credentials"}
        </h1>
        <p className="text-muted text-sm mt-2 max-w-md mx-auto">
          {isRejected
            ? "Replace the documents our team flagged, then re-submit your application for review."
            : "We check every licence by hand with the issuing council before a provider can see patients. This usually takes 24–48 hours."}
        </p>
      </div>

      {isRejected && provider.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-red-700 mb-0.5">Why your application was returned</p>
          <p className="text-sm text-red-600">{provider.rejection_reason}</p>
        </div>
      )}

      <DocumentUploadForm
        specialty={provider.specialty}
        uploadedTypes={uploadedTypes}
        isReapplying={isRejected}
        agreementAccepted={hasCurrentAgreement(provider.agreement_version)}
      />
    </div>
  );
}
