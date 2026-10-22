export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";
import { isMissingTableError } from "@/lib/facility-docs";
import FacilitiesClient from "./FacilitiesClient";

export default async function FacilitiesPage() {
  const admin = createAdminSupabase();

  const [{ data: applications, error }, { data: docRows, error: docsErr }] = await Promise.all([
    admin.from("facility_applications").select("*").order("created_at", { ascending: false }),
    // Only the type per application, to show an "awaiting documents" indicator.
    admin.from("facility_documents").select("application_id, document_type"),
  ]);

  if (error) throw new Error(`Could not load facility applications: ${error.message}`);
  if (docsErr && !isMissingTableError(docsErr)) console.error("facility documents: list failed:", docsErr);

  const docTypes = new Map<string, string[]>();
  for (const d of docRows ?? []) {
    const list = docTypes.get(d.application_id) ?? [];
    list.push(d.document_type);
    docTypes.set(d.application_id, list);
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // doc_types is null when documents couldn't be loaded (indicator hidden).
  const apps = (applications ?? []).map((a) => ({ ...a, doc_types: docsErr ? null : docTypes.get(a.id) ?? [] }));
  const stats = {
    total:             apps.length,
    pending:           apps.filter(a => a.status === "pending" || a.status === "under_review").length,
    approvedThisMonth: apps.filter(a => a.status === "approved" && a.reviewed_at && a.reviewed_at >= firstOfMonth).length,
    rejected:          apps.filter(a => a.status === "rejected").length,
  };

  return <FacilitiesClient applications={apps} stats={stats} />;
}
