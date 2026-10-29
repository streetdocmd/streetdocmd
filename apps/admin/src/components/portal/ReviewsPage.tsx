import { MessageSquareHeart } from "lucide-react";
import { requirePortalAccess } from "./access";
import { PORTALS, type PortalType } from "./config";
import { Card, EmptyState, Notice, PageHeader } from "./ui";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Pill } from "@/components/ds";
import Stars from "@/components/Stars";
import ReviewReply from "@/components/ReviewReply";

const firstName = (n: string | null | undefined) => (n ?? "Patient").split(" ")[0];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

const RATED: Record<PortalType, string> = {
  pharmacy: "Patients rate each medicine order once it's delivered.",
  lab: "Patients rate their tests once results are ready.",
  hospital: "Patients rate their care once a referral is completed.",
};

export default async function ReviewsPage({ type }: { type: PortalType }) {
  const access = await requirePortalAccess(type);
  if (!access.partnerId) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Reviews" />
        <Notice tone="blue">Each facility sees its own reviews here. Admins moderate every review from the admin console.</Notice>
      </div>
    );
  }

  const { data } = await createAdminSupabase()
    .from("facility_reviews")
    .select("*, users!patient_id(name)")
    .eq("facility_type", type)
    .eq("facility_id", access.partnerId)
    .order("created_at", { ascending: false })
    .limit(200);
  const reviews = (data ?? []) as any[];
  const shown = reviews.filter(r => !r.hidden);
  const avg = shown.length ? shown.reduce((a, r) => a + r.rating, 0) / shown.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: shown.filter(r => r.rating === n).length }));
  const unanswered = shown.filter(r => r.comment && !r.reply).length;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Reviews" description={`What patients say about your ${PORTALS[type].facilityNoun}. ${RATED[type]}`} />

      <Card className="flex items-center gap-6 p-5">
        <div className="text-center">
          <b className="block text-[40px] font-extrabold leading-none text-navy tabular-nums">{shown.length ? avg.toFixed(1) : "New"}</b>
          <div className="mt-1.5"><Stars value={avg} /></div>
          <small className="mt-1 block text-ds-xs text-muted">{shown.length} review{shown.length === 1 ? "" : "s"}</small>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {dist.map(d => (
            <div key={d.n} className="flex items-center gap-2 text-ds-xs text-muted">
              <span className="w-3 tabular-nums">{d.n}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
                <span className="block h-full rounded-pill bg-amber-500" style={{ width: `${shown.length ? (d.count / shown.length) * 100 : 0}%` }} />
              </span>
              <span className="w-5 text-right tabular-nums">{d.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {unanswered > 0 && <p className="text-ds-sm text-muted">{unanswered} written review{unanswered === 1 ? "" : "s"} waiting for a reply.</p>}

      {reviews.length === 0 ? (
        <Card><EmptyState icon={MessageSquareHeart} title="No reviews yet" description={RATED[type]} /></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <Card key={r.id} className={`p-4 ${r.hidden ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <b className="text-ds-sm text-ink">{firstName(r.users?.name)}</b>
                </span>
                <span className="text-ds-xs text-muted">{day(r.created_at)} · Ref {String(r.order_id).slice(0, 8).toUpperCase()}</span>
              </div>
              {r.hidden && <div className="mt-2"><Pill tone="idle">Hidden by StreetdocMD{r.hidden_reason ? `: ${r.hidden_reason}` : ""}</Pill></div>}
              {r.comment
                ? <p className="mt-2 text-ds-sm text-ink/85">{r.comment}</p>
                : <p className="mt-2 text-ds-sm text-muted">Rating only, no comment.</p>}
              {!r.hidden && <ReviewReply endpoint={`/api/facility/reviews/${r.id}/reply?type=${type}`} initial={r.reply} />}
            </Card>
          ))}
        </div>
      )}

      <p className="text-ds-xs text-muted">Patients see your average, their comments and your replies. Hidden reviews don&apos;t count toward your rating.</p>
    </div>
  );
}
