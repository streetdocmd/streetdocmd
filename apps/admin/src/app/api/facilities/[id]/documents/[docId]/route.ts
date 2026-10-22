import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { requireAdminApi } from "@/lib/admin-auth";
import { FACILITY_DOCS_BUCKET } from "@/lib/facility-docs";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL = 120; // seconds — long enough to open, short enough not to be worth sharing

// GET — admin only: redirect to a short-lived signed URL for one facility document.
// Generated on click, so the link on the review page never goes stale.
export async function GET(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const admin = createAdminSupabase();
  const { data: doc, error } = await admin
    .from("facility_documents")
    .select("file_url")
    .eq("id", params.docId)
    .eq("application_id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: `Could not load the document: ${error.message}` }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Document not found. It may have been replaced — reload the application." }, { status: 404 });

  const { data: signed, error: signErr } = await admin.storage
    .from(FACILITY_DOCS_BUCKET)
    .createSignedUrl(doc.file_url, SIGNED_URL_TTL);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "The file could not be found in storage." }, { status: 404 });
  }

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
