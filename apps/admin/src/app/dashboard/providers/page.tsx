import Link from "next/link";
import { Search, Download, ChevronRight, Stethoscope, CheckCheck, FileText } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { PROFESSION_LABELS } from "@/lib/shared";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ComingSoonBadge from "@/components/ComingSoonBadge";
import { missingProviderDocs, docLabel } from "@/lib/provider-docs";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending",      label: "Pending" },
  { key: "under_review", label: "Under review" },
  { key: "verified",     label: "Verified" },
  { key: "rejected",     label: "Rejected" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  pending:      { title: "No providers waiting", description: "New sign-ups and re-applications appear here once they register." },
  under_review: { title: "Nothing under review", description: "Providers you mark as under review appear here." },
  verified:     { title: "No verified providers yet", description: "Approved providers appear here." },
  rejected:     { title: "No rejected providers", description: "Rejected providers who haven't re-applied appear here." },
};

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; docs?: string };
}) {
  const supabase = createAdminSupabase();
  const status: TabKey = (TABS.some((t) => t.key === searchParams.status) ? searchParams.status : "pending") as TabKey;
  const q = (searchParams.q ?? "").trim();
  const docsFilter = searchParams.docs === "ready" || searchParams.docs === "awaiting" ? searchParams.docs : "all";

  let listQuery = supabase
    .from("providers")
    .select("id, name, specialty, specialist_field, profession, license_body, license_number, verification_status, rating, total_visits, created_at, updated_at, provider_documents(document_type)")
    .eq("verification_status", status)
    // Queues are first-come-first-served; finished lists show newest first.
    .order(status === "verified" || status === "rejected" ? "updated_at" : "created_at", {
      ascending: status === "pending" || status === "under_review",
    })
    .limit(200);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    listQuery = listQuery.or(`name.ilike.%${safe}%,license_number.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const [{ data: providers, error }, ...counts] = await Promise.all([
    listQuery,
    ...TABS.map((t) =>
      supabase.from("providers").select("id", { count: "exact", head: true }).eq("verification_status", t.key)
    ),
  ]);
  if (error) throw new Error(`Could not load providers: ${error.message}`);
  const countFor = Object.fromEntries(TABS.map((t, i) => [t.key, counts[i].count ?? 0])) as Record<TabKey, number>;

  // Flag re-applicants: in the queue now, but rejected/revoked at some point before.
  const ids = (providers ?? []).map((p) => p.id);
  let reapplied = new Set<string>();
  if ((status === "pending" || status === "under_review") && ids.length) {
    const { data: prior } = await supabase
      .from("verification_logs")
      .select("provider_id")
      .in("provider_id", ids)
      .in("action", ["rejected", "suspended"]);
    reapplied = new Set((prior ?? []).map((r) => r.provider_id));
  }

  // Providers are 'pending' from the moment they register, before uploading
  // anything — split those still awaiting required documents from ones ready to review.
  const withDocs = (providers ?? []).map((p) => {
    const types = ((p.provider_documents as { document_type: string }[] | null) ?? []).map((d) => d.document_type);
    return { ...p, docCount: types.length, missing: missingProviderDocs(p, types) };
  });
  const readyCount = withDocs.filter((p) => p.missing.length === 0).length;
  const awaitingCount = withDocs.length - readyCount;
  const rows = withDocs.filter((p) =>
    docsFilter === "ready" ? p.missing.length === 0 : docsFilter === "awaiting" ? p.missing.length > 0 : true
  );
  const isQueue = status === "pending" || status === "under_review";
  const docsHref = (d: string) =>
    `/dashboard/providers?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}${d === "all" ? "" : `&docs=${d}`}`;

  return (
    <div>
      <PageHeader
        title="Provider verification"
        description="Check credentials and approve doctors, nurses, physiotherapists and lab scientists before they can take visits."
        actions={
          <>
            <button type="button" disabled aria-disabled="true" title="Coming soon" className="btn-secondary">
              <CheckCheck size={15} aria-hidden /> Bulk actions <ComingSoonBadge />
            </button>
            <button type="button" disabled aria-disabled="true" title="Coming soon" className="btn-secondary">
              <Download size={15} aria-hidden /> Export CSV <ComingSoonBadge />
            </button>
          </>
        }
      />

      <div className="card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 pt-3 border-b border-gray-100">
          <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Verification status">
            {TABS.map((t) => {
              const active = status === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/dashboard/providers?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2 ${
                    active ? "border-blue-brand text-blue-brand" : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${active ? "bg-blue-light text-blue-brand" : "bg-gray-100 text-gray-500"}`}>
                    {countFor[t.key]}
                  </span>
                </Link>
              );
            })}
          </nav>
          <form className="relative pb-3" action="/dashboard/providers" method="get" role="search">
            <input type="hidden" name="status" value={status} />
            <Search size={15} className="absolute left-3 top-[calc(50%-6px)] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, licence no., phone…"
              className="input py-2 pl-9 lg:w-72"
              aria-label="Search providers"
            />
          </form>
        </div>

        {isQueue && withDocs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs font-medium text-gray-500 mr-1">Documents:</span>
            {[
              { key: "all", label: `All (${withDocs.length})` },
              { key: "ready", label: `Ready for review (${readyCount})` },
              { key: "awaiting", label: `Awaiting documents (${awaitingCount})` },
            ].map((f) => (
              <Link
                key={f.key}
                href={docsHref(f.key)}
                aria-current={docsFilter === f.key ? "true" : undefined}
                className={`text-xs font-medium rounded-full border px-3 py-1 transition-colors ${
                  docsFilter === f.key ? "bg-blue-brand text-white border-blue-brand" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={docsFilter !== "all" && withDocs.length > 0 ? (docsFilter === "ready" ? "No applications ready for review" : "Nobody is awaiting documents") : q ? `No ${TABS.find((t) => t.key === status)?.label.toLowerCase()} providers match “${q}”` : EMPTY_COPY[status].title}
            description={q ? "Try another search or tab." : EMPTY_COPY[status].description}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Profession</th>
                  <th>Licence</th>
                  <th>Documents</th>
                  <th>{isQueue ? "Registered" : "Updated"}</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-navy-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {p.name?.[0] ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/dashboard/providers/${p.id}`} className="font-medium text-gray-900 hover:text-blue-brand">
                              {p.name}
                            </Link>
                            <p className="text-xs text-gray-400 truncate max-w-[220px]">
                              {p.specialty}{p.specialist_field ? ` — ${p.specialist_field}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-gray-600 whitespace-nowrap">
                        {(PROFESSION_LABELS as Record<string, string>)[p.profession] ?? p.profession ?? "—"}
                      </td>
                      <td className="text-gray-600">
                        {p.license_number ? (
                          <span className="whitespace-nowrap">
                            <span className="text-gray-400">{p.license_body ?? "Licence"}</span>{" "}
                            <span className="font-mono text-xs">{p.license_number}</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 text-xs">Not provided</span>
                        )}
                      </td>
                      <td>
                        {p.missing.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                            <FileText size={14} aria-hidden /> Ready · {p.docCount}
                          </span>
                        ) : (
                          <span className="inline-flex flex-col text-xs text-amber-700" title={`Missing: ${p.missing.map(docLabel).join(", ")}`}>
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <FileText size={14} aria-hidden /> {p.docCount === 0 ? "No documents" : "Incomplete"}
                            </span>
                            <span className="text-amber-600/80">Missing {p.missing.map(docLabel).join(", ")}</span>
                          </span>
                        )}
                      </td>
                      <td className="text-gray-500 whitespace-nowrap">
                        {new Date(isQueue ? p.created_at : p.updated_at ?? p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={p.verification_status} />
                          {reapplied.has(p.id) && <StatusBadge status="reapplied" tone="purple" label="Re-application" />}
                        </div>
                      </td>
                      <td className="text-right">
                        <Link href={`/dashboard/providers/${p.id}`} className={isQueue ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}>
                          {isQueue ? "Review" : "View"} <ChevronRight size={13} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
