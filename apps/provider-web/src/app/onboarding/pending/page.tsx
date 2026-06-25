import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";

export default async function PendingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("verification_status, rejection_reason")
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/register");
  if (provider.verification_status === "verified") redirect("/dashboard");

  const isRejected = provider.verification_status === "rejected";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {isRejected ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification not approved</h1>
            <p className="text-gray-500 text-sm mb-4">
              Your application was not approved. Please review the reason below and re-submit with the correct documents.
            </p>
            {provider.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left mb-6">
                <p className="text-sm font-semibold text-red-700 mb-1">Reason:</p>
                <p className="text-sm text-red-600">{provider.rejection_reason}</p>
              </div>
            )}
            <Link href="/onboarding/documents" className="btn-primary inline-flex">
              Re-upload documents
            </Link>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification in progress</h1>
            <p className="text-gray-500 text-sm mb-6">
              Our team is reviewing your credentials. You'll receive an email once your account is
              approved — usually within 24–48 hours.
            </p>
            <div className="card p-5 text-left space-y-3 mb-6">
              <Step done label="Account created" />
              <Step done label="Documents submitted" />
              <Step pending label="Admin review" />
              <Step pending label="Account activated" />
            </div>
            <p className="text-xs text-gray-400">
              Questions? Email us at{" "}
              <a href="mailto:support@streetdocmd.com" className="text-blue-brand hover:underline">
                support@streetdocmd.com
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ done, pending, label }: { done?: boolean; pending?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
      }`}>
        {done ? "✓" : "○"}
      </div>
      <span className={`text-sm ${done ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
    </div>
  );
}