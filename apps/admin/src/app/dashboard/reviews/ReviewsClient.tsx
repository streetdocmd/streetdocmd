"use client";
import { useState } from "react";
import { MessageSquareHeart, Search } from "lucide-react";
import { Button, Pill, SegmentedControl } from "@/components/ds";
import Stars from "@/components/Stars";

export interface AdminReview {
  id: string;
  kind: "provider" | "facility";
  subjectType: "Provider" | "Pharmacy" | "Lab" | "Hospital";
  subject: string;
  patient: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
}

type Filter = "all" | "low" | "hidden";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function ReviewsClient({ reviews: initial }: { reviews: AdminReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [type, setType] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [hiding, setHiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visible = reviews
    .filter(r => filter === "all" || (filter === "low" ? r.rating <= 2 && !r.hidden : r.hidden))
    .filter(r => type === "All" || r.subjectType === type)
    .filter(r => !query.trim() || `${r.subject} ${r.patient} ${r.comment ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const shown = reviews.filter(r => !r.hidden);
  const avg = shown.length ? shown.reduce((a, r) => a + r.rating, 0) / shown.length : 0;

  async function moderate(r: AdminReview, hidden: boolean) {
    setBusy(r.id);
    setError("");
    const res = await fetch(`/api/reviews/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: r.kind, hidden, reason }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't update the review.");
      return;
    }
    setReviews(rs => rs.map(x => (x.id === r.id ? { ...x, hidden, hiddenReason: hidden ? reason.trim() : null } : x)));
    setHiding(null);
    setReason("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Reviews</h1>
        <p className="mt-1 text-ds-sm text-muted">
          Ratings from patients for providers, pharmacies, labs and hospitals. Hide a review that breaks the rules; it stops counting toward the average.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Reviews shown", value: String(shown.length) },
          { label: "Average rating", value: shown.length ? avg.toFixed(2) : "None" },
          { label: "Two stars or fewer", value: String(shown.filter(r => r.rating <= 2).length) },
          { label: "Hidden", value: String(reviews.length - shown.length) },
        ].map(k => (
          <div key={k.label} className="rounded-ds-lg border border-line bg-surface p-4 shadow-ds-sm">
            <small className="text-ds-xs font-semibold text-muted">{k.label}</small>
            <b className="mt-1 block text-ds-xl font-extrabold text-navy tabular-nums">{k.value}</b>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter> label="Show" value={filter} onChange={setFilter} className="w-full max-w-sm"
          options={[{ value: "all", label: "All" }, { value: "low", label: "Low ratings" }, { value: "hidden", label: "Hidden" }]} />
        <select aria-label="Type" value={type} onChange={e => setType(e.target.value)}
          className="min-h-[46px] rounded-ds border-[1.5px] border-line bg-surface px-3 text-ds-sm font-semibold text-ink">
          {["All", "Provider", "Pharmacy", "Lab", "Hospital"].map(t => <option key={t}>{t}</option>)}
        </select>
        <label className="relative min-w-[14rem] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or comment" aria-label="Search reviews"
            className="min-h-[46px] w-full rounded-ds border-[1.5px] border-line bg-surface pl-9 pr-3 text-ds-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none" />
        </label>
      </div>

      {error && <p role="alert" className="rounded-ds-sm bg-danger-bg px-4 py-3 text-ds-sm font-semibold text-danger">{error}</p>}

      {visible.length === 0 ? (
        <div className="rounded-ds-lg border border-line bg-surface p-12 text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-pending-bg text-muted"><MessageSquareHeart size={20} aria-hidden /></span>
          <p className="font-semibold text-ink">No reviews in this view</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-ds-lg border border-line bg-surface">
          <ul className="divide-y divide-line">
            {visible.map(r => (
              <li key={r.id} className={`grid gap-3 p-4 lg:grid-cols-[220px_1fr_auto] ${r.hidden ? "bg-page/60" : ""}`}>
                <div className="min-w-0">
                  <b className="block truncate text-ds-sm text-ink">{r.subject}</b>
                  <small className="text-ds-xs text-muted">{r.subjectType} · by {r.patient}</small>
                  <div className="mt-1"><Stars value={r.rating} /></div>
                </div>
                <div className="min-w-0">
                  {r.comment ? <p className="text-ds-sm text-ink/85">{r.comment}</p> : <p className="text-ds-sm text-muted">Rating only, no comment.</p>}
                  {r.reply && <p className="mt-2 rounded-ds-sm bg-page px-3 py-2 text-ds-xs text-ink/85"><b className="text-navy">Reply:</b> {r.reply}</p>}
                  <small className="mt-1.5 block text-ds-xs text-muted">{day(r.createdAt)}</small>
                  {r.hidden && <div className="mt-2"><Pill tone="idle">Hidden{r.hiddenReason ? `: ${r.hiddenReason}` : ""}</Pill></div>}
                  {hiding === r.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input autoFocus value={reason} onChange={e => setReason(e.target.value)} maxLength={200}
                        placeholder="Reason, e.g. personal information or abusive language" aria-label="Reason for hiding"
                        className="min-h-[42px] min-w-[16rem] flex-1 rounded-ds border-[1.5px] border-line bg-surface px-3 text-ds-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none" />
                      <Button size="sm" variant="danger" disabled={busy === r.id || !reason.trim()} onClick={() => moderate(r, true)}>
                        {busy === r.id ? "Hiding…" : "Hide review"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setHiding(null); setReason(""); }}>Cancel</Button>
                    </div>
                  )}
                </div>
                <div className="flex items-start lg:justify-end">
                  {r.hidden ? (
                    <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => moderate(r, false)}>Show again</Button>
                  ) : hiding !== r.id && (
                    <Button size="sm" variant="danger-outline" onClick={() => { setHiding(r.id); setReason(""); setError(""); }}>Hide</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
