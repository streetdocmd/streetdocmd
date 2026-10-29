import type { Metadata } from "next";
import Image from "next/image";
import { FileText, Lock } from "lucide-react";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Card } from "@/components/ds";
import { signedLink } from "@/lib/investigations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared test results · StreetdocMD", robots: { index: false, follow: false } };

const FLAG: Record<string, string> = { normal: "Normal", high: "High", low: "Low", critical: "Critical" };

// Results a patient chose to share with a doctor of their choice (link from
// /api/investigations/:id/share). The link is the only key: it expires after
// 7 days and the patient can revoke it.
export default async function SharedResultsPage({ params }: { params: { token: string } }) {
  const admin = createAdminSupabase();
  const { data: share } = await admin
    .from("investigation_shares")
    .select("order_id, expires_at, revoked_at")
    .eq("token", params.token)
    .maybeSingle();

  const valid = share && !share.revoked_at && new Date(share.expires_at).getTime() > Date.now();
  const { data: order } = valid
    ? await admin
        .from("investigation_orders")
        .select("id, resulted_at, tests, users!patient_id(name, dob), lab_partners(name), investigation_results(test_name, result_value, unit, reference_range, flag, result_pdf_url)")
        .eq("id", share!.order_id)
        .maybeSingle()
    : { data: null };

  const results = ((order?.investigation_results as any[]) ?? []);
  const report = order ? await signedLink(admin, "lab-results", results.find(r => r.result_pdf_url)?.result_pdf_url) : null;
  const patient = order?.users as any;
  const age = patient?.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86_400_000)) : null;

  return (
    <div className="min-h-screen bg-page px-5 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto dark:hidden" />
        <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="hidden h-9 w-auto dark:block" />

        {!order ? (
          <Card>
            <h1 className="text-ds-xl font-extrabold text-navy">This link isn&apos;t available</h1>
            <p className="mt-2 text-ds-sm text-muted">It may have expired or been withdrawn by the patient. Ask them to share a new link.</p>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Test results</h1>
              <p className="mt-1 text-ds-sm text-muted">
                {[patient?.name, age != null ? `${age} years` : null, (order.lab_partners as any)?.name,
                  order.resulted_at ? new Date(order.resulted_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : null]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>

            <Card padded={false} className="px-4 py-1">
              {results.length === 0 ? (
                <p className="py-4 text-ds-sm text-muted">The lab attached its report as a file.</p>
              ) : results.map((r, i) => (
                <div key={i} className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
                  <div className="min-w-0">
                    <b className="block text-ds-sm text-ink">{r.test_name}</b>
                    {r.reference_range && <small className="text-ds-xs text-muted">Reference: {r.reference_range}</small>}
                  </div>
                  <div className="text-right">
                    <b className="block text-ds-sm text-ink tabular-nums">{r.result_value ?? "See report"}{r.unit ? ` ${r.unit}` : ""}</b>
                    {r.flag && r.flag !== "normal" && <small className="text-ds-xs font-bold text-danger">{FLAG[r.flag] ?? r.flag}</small>}
                  </div>
                </div>
              ))}
            </Card>

            {report && (
              <a href={report} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-surface px-5 py-3 text-ds-sm font-bold text-navy hover:border-accent">
                <FileText size={18} aria-hidden /> Open the full lab report
              </a>
            )}

            <p className="flex items-start gap-2 text-ds-xs text-muted">
              <Lock size={14} className="mt-0.5 flex-none" aria-hidden />
              Shared by the patient through StreetdocMD. This link expires on {new Date(share!.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "long" })} and the patient can withdraw it at any time. Results are not a diagnosis.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
