/* eslint-disable @next/next/no-img-element -- signed, short-lived private URLs; skip the image optimiser */
import { notFound } from "next/navigation";
import {
  FileText, Phone, Mail, Star, Stethoscope, CalendarDays, IdCard, TriangleAlert,
  ExternalLink, Signature, RefreshCw, BellRing, ScrollText, MessageSquareText,
} from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import VerificationActions from "./VerificationActions";
import { PROFESSION_LABELS, formatNaira } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ComingSoonBadge from "@/components/ComingSoonBadge";
import { missingProviderDocs, docLabel } from "@/lib/provider-docs";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  mdcn_licence: "MDCN licence",
  nmcn_licence: "NMCN licence",
  mrtb_licence: "MRTB licence",
  mlscn_licence: "MLSCN licence",
  nin: "NIN slip",
  passport: "Passport photo",
  certificate: "Certificate",
};

const LOG_LABELS: Record<string, { label: string; status: string }> = {
  approved:     { label: "Approved",     status: "verified" },
  rejected:     { label: "Rejected",     status: "rejected" },
  suspended:    { label: "Revoked",      status: "rejected" },
  // Before migration 051, "mark under review" was logged as 'reinstated'.
  reinstated:   { label: "Under review", status: "under_review" },
  under_review: { label: "Under review", status: "under_review" },
};

const SIGNED_URL_TTL = 600; // seconds

function isImage(path: string) {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(path);
}

// provider_documents.file_url holds a bare storage path for documents
// uploaded since the provider-docs bucket became private. Older rows still
// hold a full public-URL string from before that change — extract the path
// portion from either shape so a signed URL can be generated consistently.
function providerDocPath(fileUrl: string) {
  const marker = "/storage/v1/object/public/provider-docs/";
  const idx = fileUrl.indexOf(marker);
  return idx >= 0 ? decodeURIComponent(fileUrl.slice(idx + marker.length)) : fileUrl;
}

function fmt(d: string | null | undefined, withTime = false) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export default async function ProviderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();

  // No users(email) join: email comes from Auth below, so this page works
  // whether or not users.email exists in the live schema.
  const [{ data: provider, error: providerErr }, { data: logs }, { data: services }] = await Promise.all([
    supabase.from("providers").select("*, provider_documents(*)").eq("id", params.id).maybeSingle(),
    supabase
      .from("verification_logs")
      .select("id, action, notes, created_at, admin_id")
      .eq("provider_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("provider_services")
      .select("id, name, description, price, duration_minutes, active")
      .eq("provider_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (providerErr) throw new Error(`Could not load provider: ${providerErr.message}`);
  if (!provider) notFound();

  // Email (from Auth) and the names of admins in the history.
  const adminIds = Array.from(new Set((logs ?? []).map((l) => l.admin_id).filter(Boolean)));
  const [authUser, { data: admins }] = await Promise.all([
    supabase.auth.admin.getUserById(provider.user_id).then((r) => r.data.user).catch(() => null),
    adminIds.length
      ? supabase.from("users").select("id, name").in("id", adminIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  // provider_registration_answers arrives with migration 049 — a missing table
  // just means nothing to show.
  const { data: answerRows } = await supabase
    .from("provider_registration_answers")
    .select("expected_rate, questions, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const answers = (answerRows ?? [])[0] as { expected_rate: number | null; questions: string | null; created_at: string } | undefined;

  const adminName = new Map((admins ?? []).map((a) => [a.id, a.name]));
  const email = authUser?.email ?? null;

  const rawDocs = ((provider.provider_documents ?? []) as {
    id: string; document_type: string; file_url: string; uploaded_at: string;
  }[]).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  // provider-docs is a private bucket (credential documents) — resolve each
  // file to a short-lived signed URL rather than linking to it directly.
  const docs = await Promise.all(
    rawDocs.map(async (doc) => {
      const path = providerDocPath(doc.file_url);
      const { data: signed } = await supabase.storage.from("provider-docs").createSignedUrl(path, SIGNED_URL_TTL);
      return { ...doc, path, viewUrl: signed?.signedUrl ?? null };
    })
  );

  const missingDocs = missingProviderDocs(provider, rawDocs.map((d) => d.document_type));
  const history = logs ?? [];
  const lastRejection = history.find((l) => l.action === "rejected" || l.action === "suspended");
  const isReapplicant =
    (provider.verification_status === "pending" || provider.verification_status === "under_review") && !!lastRejection;
  const isNewSinceRejection = (uploadedAt: string) => !!lastRejection && uploadedAt > lastRejection.created_at;

  const professionLabel = (PROFESSION_LABELS as Record<string, string>)[provider.profession] ?? provider.profession ?? "Provider";
  const licenceBody: string | null = provider.license_body ?? (provider.mdcn_number ? "MDCN" : provider.nmcn_number ? "NMCN" : null);
  const licenceNumber: string | null = provider.license_number ?? provider.mdcn_number ?? provider.nmcn_number ?? null;

  // Migration 046 may not be applied yet — distinguish "column missing" from "not accepted".
  const agreementTracked = "agreement_version" in provider;
  const agreementAccepted = !!provider.agreement_accepted_at;

  return (
    <div className="max-w-5xl">
      <PageHeader
        backHref={`/dashboard/providers?status=${provider.verification_status}`}
        backLabel="Provider verification"
        title={provider.name}
        meta={
          <>
            <StatusBadge status={provider.verification_status} />
            {isReapplicant && <StatusBadge status="reapplied" tone="purple" label="Re-application" />}
            <span className="text-sm text-gray-500">{professionLabel}</span>
            <span className="text-gray-300" aria-hidden>·</span>
            <span className="text-sm text-gray-500">Joined {fmt(provider.created_at)}</span>
          </>
        }
      />

      {isReapplicant && lastRejection && (
        <div className="card border-purple-200 bg-purple-50/60 p-4 mb-5 flex gap-3 text-sm">
          <RefreshCw size={18} className="text-purple-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold text-purple-900">
              Re-application — previously {lastRejection.action === "suspended" ? "revoked" : "rejected"} on {fmt(lastRejection.created_at)}
            </p>
            {lastRejection.notes && <p className="text-purple-800 mt-0.5">Reason given: “{lastRejection.notes}”</p>}
            <p className="text-purple-700 mt-1">Documents uploaded since then are marked <strong>New</strong> below.</p>
          </div>
        </div>
      )}

      {provider.verification_status === "rejected" && provider.rejection_reason && (
        <div className="card border-red-200 bg-red-50/60 p-4 mb-5 flex gap-3 text-sm">
          <TriangleAlert size={18} className="text-red-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold text-red-800">Rejection reason shown to the provider</p>
            <p className="text-red-700 mt-0.5 whitespace-pre-wrap">{provider.rejection_reason}</p>
          </div>
        </div>
      )}

      {missingDocs.length > 0 && provider.verification_status !== "verified" && (
        <div className="card border-amber-200 bg-amber-50/60 p-4 mb-5 flex gap-3 text-sm">
          <TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold text-amber-900">Awaiting documents — not ready for review</p>
            <p className="text-amber-800 mt-0.5">
              Still missing: {missingDocs.map(docLabel).join(", ")}. The provider uploads these from the onboarding screen in the provider app.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Profile */}
          <section className="card p-5">
            <div className="flex items-start gap-4">
              {provider.photo_url ? (
                <img src={provider.photo_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0 bg-gray-100" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-navy-700 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                  {provider.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-gray-900">
                  {provider.specialty}{provider.specialist_field ? ` — ${provider.specialist_field}` : ""}
                </p>
                <p className="text-sm text-gray-500">{provider.credentials}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Mail size={15} className="text-gray-400 shrink-0" aria-hidden />
                    {email ? <a href={`mailto:${email}`} className="hover:text-blue-brand truncate">{email}</a> : "—"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Phone size={15} className="text-gray-400 shrink-0" aria-hidden />
                    {provider.phone ? <a href={`tel:${provider.phone}`} className="hover:text-blue-brand">{provider.phone}</a> : "—"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Stethoscope size={15} className="text-gray-400 shrink-0" aria-hidden />
                    {provider.years_experience ?? 0} yr{provider.years_experience === 1 ? "" : "s"} experience
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Star size={15} className="text-gray-400 shrink-0" aria-hidden />
                    {Number(provider.rating) > 0 ? `${provider.rating} rating` : "No ratings yet"} · {provider.total_visits ?? 0} visit{provider.total_visits === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>
            {provider.bio && (
              <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{provider.bio}</p>
            )}
          </section>

          {/* Documents */}
          <section className="card">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Documents <span className="ml-1 text-xs font-normal text-gray-400">({docs.length})</span>
              </h2>
              {docs.length > 0 && <p className="text-xs text-gray-400">Links expire after 10 minutes — reload to refresh.</p>}
            </div>
            {docs.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="No documents uploaded yet"
                description="The provider uploads their licence and ID from the provider app's onboarding screen."
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 px-5 pb-5">
                {docs.map((doc) => (
                  <li key={doc.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    {!doc.viewUrl ? (
                      <div className="flex flex-col items-center justify-center h-40 bg-gray-50 text-center px-4">
                        <TriangleAlert size={22} className="text-amber-500 mb-2" aria-hidden />
                        <p className="text-sm font-medium text-gray-600">Preview unavailable</p>
                        <p className="text-xs text-gray-400 mt-0.5 break-all">The file could not be found in storage.</p>
                      </div>
                    ) : isImage(doc.path) ? (
                      <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer" className="block h-40 bg-gray-50">
                        <img src={doc.viewUrl} alt={DOC_LABELS[doc.document_type] ?? doc.document_type} className="w-full h-full object-contain" />
                      </a>
                    ) : (
                      <a
                        href={doc.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center h-40 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <FileText size={28} className="text-gray-400 mb-2" aria-hidden />
                        <span className="text-sm font-medium text-blue-brand">Open PDF</span>
                      </a>
                    )}
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-gray-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {DOC_LABELS[doc.document_type] ?? doc.document_type.replace(/_/g, " ")}
                          {isNewSinceRejection(doc.uploaded_at) && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.5">New</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">Uploaded {fmt(doc.uploaded_at, true)}</p>
                      </div>
                      {doc.viewUrl && (
                        <a href={doc.viewUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-brand shrink-0" aria-label="Open full size">
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Services (non-doctors list their own services) */}
          {provider.profession && provider.profession !== "doctor" && (
            <section className="card">
              <h2 className="px-5 pt-5 pb-3 text-sm font-semibold text-gray-900">
                Services <span className="ml-1 text-xs font-normal text-gray-400">({(services ?? []).length})</span>
              </h2>
              {(services ?? []).length === 0 ? (
                <p className="px-5 pb-5 text-sm text-gray-400">This provider hasn&apos;t listed any services yet.</p>
              ) : (
                <ul className="px-5 pb-3">
                  {(services ?? []).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 border-b border-gray-50 last:border-0 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-gray-700">{formatNaira(s.price)}</span>
                        <StatusBadge status={s.active ? "active" : "inactive"} tone={s.active ? "success" : "neutral"} label={s.active ? "Active" : "Inactive"} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <VerificationActions
            providerId={provider.id}
            providerName={provider.name}
            currentStatus={provider.verification_status}
            documentCount={docs.length}
            missingDocs={missingDocs.map(docLabel)}
            hasLicence={!!licenceNumber}
          />

          {/* Licence */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <IdCard size={16} className="text-gray-400" aria-hidden /> Practising licence
            </h2>
            {licenceNumber ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Regulator</dt><dd className="font-medium text-gray-900">{licenceBody ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Number</dt><dd className="font-mono font-medium text-gray-900 break-all">{licenceNumber}</dd></div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-amber-700">No licence number on file.</p>
            )}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-sm text-gray-400">
              <span className="inline-flex items-center gap-2"><BellRing size={14} aria-hidden /> Annual re-verification reminders</span>
              <ComingSoonBadge />
            </div>
          </section>

          {/* Agreement */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Signature size={16} className="text-gray-400" aria-hidden /> Service agreement
            </h2>
            {!agreementTracked ? (
              <p className="mt-2 text-sm text-gray-500">Agreement tracking isn&apos;t enabled on the database yet (migration 046).</p>
            ) : agreementAccepted ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Version</dt><dd className="font-medium text-gray-900">{provider.agreement_version ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Accepted</dt><dd className="font-medium text-gray-900 text-right">{fmt(provider.agreement_accepted_at, true)}</dd></div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Commission</dt>
                  <dd className="font-medium text-gray-900">{provider.agreement_commission_rate != null ? `${Number(provider.agreement_commission_rate)}%` : "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-amber-700">
                Not accepted — this provider registered before click-to-accept was introduced.
              </p>
            )}
          </section>

          {/* Registration answers (migration 049) */}
          {answers && (answers.expected_rate != null || answers.questions) && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquareText size={16} className="text-gray-400" aria-hidden /> Registration answers
              </h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Expected rate per booking</dt>
                  <dd className="font-medium text-gray-900">{answers.expected_rate != null ? formatNaira(Number(answers.expected_rate)) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Questions or suggestions</dt>
                  <dd className="text-gray-800 whitespace-pre-wrap">{answers.questions || "—"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-400">Visible to admins only.</p>
            </section>
          )}

          {/* History */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ScrollText size={16} className="text-gray-400" aria-hidden /> Verification history
            </h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No decisions recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {history.map((log) => {
                  const m = LOG_LABELS[log.action] ?? { label: log.action, status: "neutral" };
                  return (
                    <li key={log.id} className="text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={m.status} label={m.label} />
                        <span className="text-xs text-gray-400">{fmt(log.created_at, true)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
                        <CalendarDays size={12} aria-hidden /> by {adminName.get(log.admin_id) ?? "Admin"}
                      </p>
                      {log.notes && <p className="text-sm text-gray-600 mt-1">“{log.notes}”</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
