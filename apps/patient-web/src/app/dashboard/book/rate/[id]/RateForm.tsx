"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

export default function RateForm({ bookingId, providerId, patientId }: {
  bookingId: string;
  providerId: string;
  patientId: string;
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
    router.push("/dashboard/bookings");
    router.refresh();
  }

  const display = hover || rating;

  return (
    <div className="card p-6">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="label mb-3">Your rating</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="text-4xl transition-transform hover:scale-110"
              >
                <span className={n <= display ? "text-amber-400" : "text-gray-200"}>★</span>
              </button>
            ))}
          </div>
          {display > 0 && (
            <p className="text-sm font-medium text-blue-brand mt-2">{LABELS[display]}</p>
          )}
        </div>

        <div>
          <label className="label">Comments <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            className="input resize-none min-h-[100px]"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us about your experience…"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || rating === 0} className="btn-primary">
            {submitting ? "Submitting…" : "Submit Rating"}
          </button>
          <button type="button" onClick={() => router.push("/dashboard/bookings")} className="btn-secondary">
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}