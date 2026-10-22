export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase-server";
import { isMissingTableError, type FacilityDocument } from "@/lib/facility-docs";
import FacilityReviewClient from "./FacilityReviewClient";

export default async function FacilityReviewPage({ params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const [{ data: app, error }, { data: docRows, error: docsErr }] = await Promise.all([
    admin.from("facility_applications").select("*").eq("id", params.id).maybeSingle(),
    admin
      .from("facility_documents")
      .select("id, document_type, file_name, uploaded_at")
      .eq("application_id", params.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (error) throw new Error(`Could not load this application: ${error.message}`);
  if (!app) notFound();
  // Migration 052 not applied yet → no uploads to show (the page still works).
  if (docsErr && !isMissingTableError(docsErr)) throw new Error(`Could not load documents: ${docsErr.message}`);

  let reviewerName: string | null = null;
  if (app.reviewed_by) {
    const { data: reviewer } = await admin.from("users").select("name").eq("id", app.reviewed_by).maybeSingle();
    reviewerName = reviewer?.name ?? null;
  }

  return (
    <FacilityReviewClient
      application={app}
      reviewerName={reviewerName}
      uploads={(docRows ?? []) as FacilityDocument[]}
      uploadsUnavailable={!!docsErr}
    />
  );
}
