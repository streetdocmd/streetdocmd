"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, Card, Notice, cx, fieldLabelClass, focusRing, inputClass } from "@/components/ds";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function RateForm({ bookingId, providerId, patientId, inline = false }: {
  bookingId: string;
  providerId: string;
  patientId: string;
  /** Inside the visit record: stay on the page and refresh it after saving */
  inline?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      provider_id: providerId,
      patient_id: patientId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (err) { setError("Could not submit rating. Please try again."); return; }
    if (!inline) router.push("/dashboard/bookings");
    router.refresh();
  }

  const display = hover || rating;

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className={cx("rounded-md p-0.5 transition-transform hover:scale-110", focusRing)}
              >
                <Star size={32} className={n <= display ? "fill-amber-500 text-amber-500" : "fill-line text-amber-500"} aria-hidden />
              </button>
            ))}
          </div>
          <p className="mt-2 text-ds-sm text-muted">
            {display > 0 ? LABELS[display] : "Tap a star to rate your visit."}
          </p>
        </div>

        {rating > 0 && (
          <div>
            <label htmlFor="rate-comment" className={fieldLabelClass}>
              Comments <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="rate-comment"
              className={inputClass(false, "min-h-24 resize-none py-3 leading-normal")}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell us about your experience"
            />
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        {(rating > 0 || !inline) && (
          <div className="flex gap-2.5">
            <Button type="submit" disabled={submitting || rating === 0}>
              {submitting ? "Submitting…" : "Submit rating"}
            </Button>
            {!inline && (
              <Button variant="secondary" onClick={() => router.push("/dashboard/bookings")}>Skip for now</Button>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
