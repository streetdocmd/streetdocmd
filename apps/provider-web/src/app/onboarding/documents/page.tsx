import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import DocumentUploadForm from "./DocumentUploadForm";

export default async function DocumentsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id, specialty, verification_status")
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/register");
  if (provider.verification_status !== "pending") redirect("/dashboard");

  const { data: existingDocs } = await supabase
    .from("provider_documents")
    .select("id")
    .eq("provider_id", provider.id);

  if (existingDocs && existingDocs.length > 0) redirect("/onboarding/pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Upload your credentials</h1>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Because Nigeria doesn't have a centralised health professional database, we verify
            credentials manually. This usually takes 24–48 hours.
          </p>
        </div>

        <DocumentUploadForm specialty={provider.specialty} />
      </div>
    </div>
  );
}