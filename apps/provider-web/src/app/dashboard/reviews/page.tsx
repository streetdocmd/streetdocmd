import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Card, Pill, TopBar } from "@/components/ds";
import ReviewReply from "@/components/ReviewReply";

export const dynamic = "force-dynamic";

const firstName = (n: string | null | undefined) => (n ?? "Patient").split(" ")[0];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} className={n <= Math.round(value) ? "fill-amber-500 text-amber-500" : "fill-line text-line"} aria-hidden />
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: provider } = await supabase.from("providers").select("id, rating").eq("user_id", user.id).single();
  if (!provider) redirect("/dashboard");

  // Service role, scoped to this provider: includes hidden reviews and the
  // patient's first name, which users RLS doesn't expose to providers
  const { data } = await createAdminSupabase()
    .from("reviews")
    .select("*, users!patient_id(name)")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const reviews = (data ?? []) as any[];
  const shown = reviews.filter(r => !r.hidden);
  const avg = shown.length ? shown.reduce((a, r) => a + r.rating, 0) / shown.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: shown.filter(r => r.rating === n).length }));
  const unanswered = shown.filter(r => r.comment && !r.reply).length;

  return (
    <div className="mx-auto max-w-lg">
      <TopBar title="Reviews" backHref="/dashboard/profile" className="-mx-5 -mt-2 md:mx-0" />

      <Card className="flex items-center gap-5">
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

      {unanswered > 0 && (
        <p className="mt-3 text-ds-sm text-muted">{unanswered} written review{unanswered === 1 ? "" : "s"} waiting for a reply.</p>
      )}

      <section className="mt-[26px] space-y-3">
        {reviews.length === 0 ? (
          <Card><p className="text-ds-sm text-muted">No reviews yet. Patients can rate each visit once it&apos;s complete.</p></Card>
        ) : reviews.map(r => (
          <Card key={r.id} className={r.hidden ? "opacity-70" : ""}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Stars value={r.rating} />
                <b className="text-ds-sm text-ink">{firstName(r.users?.name)}</b>
              </span>
              <span className="text-ds-xs text-muted">{day(r.created_at)}</span>
            </div>
            {r.hidden && (
              <div className="mt-2"><Pill tone="idle">Hidden by StreetdocMD{r.hidden_reason ? `: ${r.hidden_reason}` : ""}</Pill></div>
            )}
            {r.comment
              ? <p className="mt-2 text-ds-sm text-ink/85">{r.comment}</p>
              : <p className="mt-2 text-ds-sm text-muted">Rating only, no comment.</p>}
            {!r.hidden && <ReviewReply endpoint={`/api/reviews/${r.id}/reply`} initial={r.reply} />}
          </Card>
        ))}
      </section>

      <p className="mt-4 text-ds-xs text-muted">
        Patients see your average, their comments and your replies. Hidden reviews don&apos;t count toward your rating.
      </p>
    </div>
  );
}
