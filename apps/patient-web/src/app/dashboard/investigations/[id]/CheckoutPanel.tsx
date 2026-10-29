"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileUp, Star } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { Button, Card, Notice, SegmentedControl, cx, fieldLabelClass, inputClass } from "@/components/ds";
import { formatNaira } from "@/lib/shared";
import type { Quote } from "@/lib/investigations";

type Window = "morning" | "afternoon" | "evening";

// Approve and pay for a doctor's order, or book your own: collection address,
// date and time, phone, an optional outside doctor's request, then the
// itemised price from the best lab and payment. Prices are worked out on the
// server; this only shows them.
export default function CheckoutPanel({
  orderId, fromDoctor, doctorCollected, defaultPhone, initial,
}: {
  orderId: string;
  fromDoctor: boolean;
  /** The doctor took the sample during the visit: no collection time needed */
  doctorCollected: boolean;
  defaultPhone: string | null;
  initial: { address: string | null; lat: number | null; lng: number | null };
}) {
  const router = useRouter();
  const [loc, setLoc] = useState<{ lat: number; lng: number; address: string } | null>(
    initial.lat != null && initial.lng != null && initial.address ? { lat: initial.lat, lng: initial.lng, address: initial.address } : null,
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [slot, setSlot] = useState<Window>("morning");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [ext, setExt] = useState({ doctor: "", facility: "", notes: "" });
  const [extFile, setExtFile] = useState<File | null>(null);
  const [showExt, setShowExt] = useState(false);
  const [paying, setPaying] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loc) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true);
    setQuoteError("");
    fetch("/api/investigations/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, lat: loc.lat, lng: loc.lng }),
    })
      .then(async r => ({ ok: r.ok, json: await r.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (ok) setQuote(json.quote);
        else { setQuote(null); setQuoteError(json.error ?? "Couldn't work out the price."); }
      })
      .catch(() => !cancelled && setQuoteError("Couldn't work out the price. Check your connection and try again."))
      .finally(() => !cancelled && setQuoting(false));
    return () => { cancelled = true; };
  }, [loc, orderId]);

  async function pay() {
    if (!loc || !quote) return;
    setPaying(true);
    setError("");
    const form = new FormData();
    form.append("address", loc.address);
    form.append("lat", String(loc.lat));
    form.append("lng", String(loc.lng));
    form.append("phone", phone);
    if (!doctorCollected) { form.append("date", date); form.append("window", slot); }
    if (!fromDoctor) {
      form.append("ext_doctor", ext.doctor);
      form.append("ext_facility", ext.facility);
      form.append("ext_notes", ext.notes);
      if (extFile) form.append("ext_file", extFile);
    }
    const res = await fetch(`/api/investigations/${orderId}/checkout`, { method: "POST", body: form }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.authorization_url) {
      setPaying(false);
      setError(json.error ?? "Couldn't start the payment. Check your connection and try again.");
      return;
    }
    window.location.href = json.authorization_url;
  }

  async function decline() {
    if (!confirm(fromDoctor ? "Decline the tests your doctor requested? You can talk to your doctor about other options." : "Cancel this order?")) return;
    setDeclining(true);
    const res = await fetch(`/api/investigations/${orderId}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setDeclining(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't update the order."); return; }
    router.refresh();
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-2 text-[17px] font-bold text-navy">{doctorCollected ? "Your address" : "Where should we collect the sample?"}</h2>
        {loc ? (
          <Card className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-ds-sm text-ink">{loc.address}</span>
            <button type="button" onClick={() => setLoc(null)} className="flex-none text-ds-sm font-bold text-accent hover:underline">Change</button>
          </Card>
        ) : (
          <LocationPicker onReady={(c, address) => setLoc({ lat: c.lat, lng: c.lng, address })} onReset={() => setLoc(null)} />
        )}
      </section>

      {!doctorCollected && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inv-date" className={fieldLabelClass}>Collection date</label>
            <input id="inv-date" type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <span className={fieldLabelClass}>Time window</span>
            <SegmentedControl<Window> label="Time window" value={slot} onChange={setSlot}
              options={[{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "evening", label: "Evening" }]} />
          </div>
        </section>
      )}

      <div>
        <label htmlFor="inv-phone" className={fieldLabelClass}>Phone the {doctorCollected ? "lab" : "collector"} can call</label>
        <input id="inv-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass()} placeholder="0803 000 0000" />
      </div>

      {!fromDoctor && (
        <section>
          {!showExt ? (
            <button type="button" onClick={() => setShowExt(true)} className="text-ds-sm font-bold text-accent hover:underline">
              + A doctor outside StreetdocMD asked for these tests
            </button>
          ) : (
            <Card className="space-y-3">
              <p className="text-ds-sm font-bold text-navy">Your doctor&apos;s request <span className="font-normal text-muted">(optional)</span></p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input aria-label="Doctor's name" className={inputClass()} placeholder="Doctor's name" value={ext.doctor} onChange={e => setExt(v => ({ ...v, doctor: e.target.value }))} />
                <input aria-label="Hospital or clinic" className={inputClass()} placeholder="Hospital or clinic" value={ext.facility} onChange={e => setExt(v => ({ ...v, facility: e.target.value }))} />
              </div>
              <textarea aria-label="Notes from the request" className={inputClass(false, "min-h-20 resize-none py-3")} placeholder="Anything on the request the lab should know"
                value={ext.notes} onChange={e => setExt(v => ({ ...v, notes: e.target.value }))} />
              <label className="flex cursor-pointer items-center gap-2 text-ds-sm font-bold text-accent">
                <FileUp size={16} aria-hidden /> {extFile ? extFile.name : "Attach the request (PDF or photo)"}
                <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={e => setExtFile(e.target.files?.[0] ?? null)} />
              </label>
            </Card>
          )}
        </section>
      )}

      {loc && (
        <section aria-live="polite">
          <h2 className="mb-2 text-[17px] font-bold text-navy">Cost</h2>
          {quoting ? (
            <Card><p className="text-ds-sm text-muted">Finding the best lab near you…</p></Card>
          ) : quoteError ? (
            <Notice tone="warn">{quoteError}</Notice>
          ) : quote && (
            <Card padded={false} className="px-4 py-1">
              <div className="flex items-center justify-between gap-3 border-b border-line py-3">
                <span className="min-w-0">
                  <b className="block text-ds-sm text-ink">{quote.lab_name}</b>
                  <small className="text-ds-xs text-muted">
                    {quote.review_count > 0
                      ? <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-500 text-amber-500" aria-hidden />{quote.rating.toFixed(1)} ({quote.review_count})</span>
                      : "New partner lab"} · {quote.distance_km.toFixed(1)} km away
                  </small>
                </span>
              </div>
              {quote.items.map(i => (
                <div key={i.platform_test_id} className="border-b border-line py-3">
                  <div className="flex items-start justify-between gap-3 text-ds-sm">
                    <span className="text-ink">{i.test_name}</span>
                    <span className="font-bold text-ink tabular-nums">{formatNaira(i.price)}</span>
                  </div>
                  {i.preparation && <small className="mt-1 block text-ds-xs text-warn">{i.preparation}</small>}
                </div>
              ))}
              <Row label={doctorCollected ? "Home collection (sample already taken)" : "Home collection"} value={formatNaira(quote.collection_fee)} />
              <Row label="StreetdocMD service charge" value={formatNaira(quote.service_charge)} />
              <div className="flex items-center justify-between py-3">
                <b className="text-ds-control text-navy">Total</b>
                <b className="text-ds-lg font-extrabold text-navy tabular-nums">{formatNaira(quote.total)}</b>
              </div>
            </Card>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-ds-sm bg-danger-bg px-3.5 py-2.5 text-ds-sm font-semibold text-danger">
          <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden /> {error}
        </p>
      )}

      <div className={cx("flex flex-col gap-2.5 sm:flex-row")}>
        <Button block onClick={pay} disabled={!loc || !quote || paying || phone.replace(/\D/g, "").length < 10}>
          {paying ? "Opening payment…" : quote ? `${fromDoctor ? "Approve and pay" : "Pay"} ${formatNaira(quote.total)}` : "Choose an address to see the price"}
        </Button>
        <Button variant="secondary" onClick={decline} disabled={declining}>{fromDoctor ? "Decline" : "Cancel"}</Button>
      </div>
      <p className="text-ds-xs text-muted">
        Once paid, the order can&apos;t be cancelled. Payment is confirmed by Paystack before the lab is asked.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 text-ds-sm">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}
