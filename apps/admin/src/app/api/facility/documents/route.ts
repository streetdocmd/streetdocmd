import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import {
  FACILITY_DOCS_BUCKET, FACILITY_DOC_MAX_SIZE, FACILITY_DOC_MIME_TYPES,
  isAllowedFacilityDocType, isMissingTableError, missingFacilityDocs,
} from "@/lib/facility-docs";

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminSupabase>;
type OwnedApplication = { id: string; name: string; facility_type: string; status: string };

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

const NOT_READY = "Document uploads aren't available yet. Please try again later or email contact@streetdocmd.com.";

/**
 * The signed-in user's latest facility application, if they may still change
 * its documents (pending or under review). Ownership comes from
 * facility_applications.user_id matched against the id Supabase Auth
 * verified from the session — never from the request body.
 */
async function getEditableApplication(admin: Admin): Promise<
  { ok: true; app: OwnedApplication } | { ok: false; response: NextResponse }
> {
  const { data: { user } } = await createServerSupabase().auth.getUser();
  if (!user) return { ok: false, response: json("Your session has expired. Please sign in again.", 401) };

  const { data: app, error } = await admin
    .from("facility_applications")
    .select("id, name, facility_type, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, response: json("We couldn't load your application. Please try again.", 500) };
  if (!app) return { ok: false, response: json("We couldn't find a facility application for this account.", 404) };
  if (app.status === "approved") {
    return { ok: false, response: json("Your facility is already approved. To change your documents, email contact@streetdocmd.com.", 409) };
  }
  if (app.status !== "pending" && app.status !== "under_review") {
    return { ok: false, response: json("This application was not approved. Re-apply first, then upload your documents to the new application.", 409) };
  }
  return { ok: true, app: app as OwnedApplication };
}

/** Checks the file's first bytes really are a PDF, PNG or JPEG. */
function matchesSignature(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; // JPEG
}

function cleanFileName(name: string) {
  const cleaned = name.replace(/[\\/]/g, "_").replace(/[^\x20-\x7E]/g, "").trim();
  return (cleaned || "document").slice(0, 200);
}

async function notifyOpsIfComplete(admin: Admin, app: OwnedApplication, before: string[], after: string[]) {
  const wasComplete = missingFacilityDocs(app.facility_type, before).length === 0;
  const isComplete = missingFacilityDocs(app.facility_type, after).length === 0;
  const termiiKey = process.env.TERMII_API_KEY;
  if (wasComplete || !isComplete || !termiiKey) return;
  const opsPhone = process.env.OPS_PHONE ?? "2347063216791";
  await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: opsPhone,
      from: "StreetdocMD",
      sms: `Facility documents complete: ${app.name} (${app.facility_type}) has uploaded all required documents. Review at /dashboard/facilities/${app.id}`,
      type: "plain",
      channel: "generic",
      api_key: termiiKey,
    }),
  }).catch(() => {});
}

// POST (multipart: file, doc_type) — upload or replace one document
export async function POST(req: NextRequest) {
  const admin = createAdminSupabase();
  const owned = await getEditableApplication(admin);
  if (!owned.ok) return owned.response;
  const app = owned.app;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const docType = form?.get("doc_type");
  if (!(file instanceof File) || typeof docType !== "string") return json("Choose a file to upload.", 400);
  if (!isAllowedFacilityDocType(app.facility_type, docType)) return json("This document type isn't needed for your facility.", 400);
  if (file.size === 0) return json("This file is empty. Please choose another.", 400);
  if (file.size > FACILITY_DOC_MAX_SIZE) return json("This file is larger than 10 MB. Please upload a smaller copy.", 400);
  if (!FACILITY_DOC_MIME_TYPES.includes(file.type)) return json("Only PDF, JPG or PNG files can be uploaded.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type)) return json("This file doesn't look like a valid PDF, JPG or PNG. Please choose another.", 400);

  const { data: existing, error: listErr } = await admin
    .from("facility_documents")
    .select("id, document_type, file_url")
    .eq("application_id", app.id);
  if (listErr) {
    console.error("facility documents: list failed:", listErr);
    return json(isMissingTableError(listErr) ? NOT_READY : "We couldn't save your document. Please try again.", isMissingTableError(listErr) ? 503 : 500);
  }

  // Private bucket: files are only ever read through short-lived signed URLs.
  // Ignore the error — it already exists after the first upload.
  await admin.storage.createBucket(FACILITY_DOCS_BUCKET, {
    public: false,
    fileSizeLimit: FACILITY_DOC_MAX_SIZE,
    allowedMimeTypes: FACILITY_DOC_MIME_TYPES,
  });

  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${app.id}/${docType}_${Date.now()}.${ext}`;
  const { error: uploadErr } = await admin.storage
    .from(FACILITY_DOCS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadErr) {
    console.error("facility documents: upload failed:", uploadErr);
    return json("We couldn't upload your file. Please try again.", 500);
  }

  const { data: doc, error: dbErr } = await admin
    .from("facility_documents")
    .insert({ application_id: app.id, document_type: docType, file_url: path, file_name: cleanFileName(file.name) })
    .select("id, document_type, file_name, uploaded_at")
    .single();
  if (dbErr || !doc) {
    console.error("facility documents: insert failed:", dbErr);
    await admin.storage.from(FACILITY_DOCS_BUCKET).remove([path]);
    return json("We couldn't save your document. Please try again.", 500);
  }

  // One file per document type: the new upload replaces any earlier one.
  const replaced = (existing ?? []).filter((d) => d.document_type === docType);
  if (replaced.length > 0) {
    await admin.from("facility_documents").delete().in("id", replaced.map((d) => d.id));
    await admin.storage.from(FACILITY_DOCS_BUCKET).remove(replaced.map((d) => d.file_url));
  }

  const before = (existing ?? []).map((d) => d.document_type);
  await notifyOpsIfComplete(admin, app, before, [...before, docType]);

  return NextResponse.json({ document: doc });
}

// DELETE ?id=<document id> — remove one of your own documents
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return json("Missing document id.", 400);

  const admin = createAdminSupabase();
  const owned = await getEditableApplication(admin);
  if (!owned.ok) return owned.response;

  const { data: doc, error } = await admin
    .from("facility_documents")
    .select("id, file_url")
    .eq("id", id)
    .eq("application_id", owned.app.id)
    .maybeSingle();
  if (error) return json(isMissingTableError(error) ? NOT_READY : "We couldn't remove this document. Please try again.", 500);
  if (!doc) return json("This document was not found. Refresh the page to see your latest documents.", 404);

  const { error: delErr } = await admin.from("facility_documents").delete().eq("id", doc.id);
  if (delErr) return json("We couldn't remove this document. Please try again.", 500);
  await admin.storage.from(FACILITY_DOCS_BUCKET).remove([doc.file_url]);

  return NextResponse.json({ ok: true });
}
