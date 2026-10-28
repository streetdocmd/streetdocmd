"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart } from "lucide-react";
import { Avatar, Button, Card, Notice, Pill, Stepper, VerifiedBadge, cx, focusRing } from "@/components/ds";
import { formatNaira } from "@/lib/shared";
import LocationPicker from "@/components/LocationPicker";

interface CatalogueItem {
  id: string;
  drug_name: string;
  generic_name: string | null;
  formulation: string | null;
  strength: string | null;
  price: number;
  stock: "in" | "low" | "out";
  stock_left: number | null;
}

interface PharmacyInfo {
  name: string;
  opening_hours: string | null;
  delivery_eta_minutes: number | null;
}

// preselect: medicine names from a visit record ("Send to a pharmacy"); matching
// catalogue items start with a quantity of 1 once the nearest pharmacy loads.
export default function MedicationPicker({ preselect = [] }: { preselect?: string[] }) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyInfo | null>(null);
  const pharmacyName = pharmacy?.name ?? "";
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onLocationReady(c: { lat: number; lng: number }, a: string) {
    setCoords(c);
    setAddress(a);
    setLoadingCatalogue(true);
    setCatalogueError("");
    try {
      const res = await fetch(`/api/pharmacy/catalogue?lat=${c.lat}&lng=${c.lng}`);
      const json = await res.json();
      if (!res.ok) { setCatalogueError(json.error ?? "Could not load nearby pharmacy"); setLoadingCatalogue(false); return; }
      setPharmacy(json.pharmacy);
      const loaded: CatalogueItem[] = json.items ?? [];
      setItems(loaded);
      if (preselect.length) {
        const wanted = preselect.map(n => n.toLowerCase());
        const matches = loaded.filter(i => i.stock !== "out" && wanted.some(w => w.includes(i.drug_name.toLowerCase()) || i.drug_name.toLowerCase().includes(w)));
        if (matches.length) setQuantities(Object.fromEntries(matches.map(m => [m.id, 1])));
      }
    } catch {
      setCatalogueError("Could not reach the server. Check your connection and try again.");
    }
    setLoadingCatalogue(false);
  }

  function resetLocation() {
    setCoords(null);
    setAddress("");
    setItems([]);
    setQuantities({});
  }

  function changeQty(id: string, delta: number) {
    setQuantities(prev => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id]; else copy[id] = next;
      return copy;
    });
  }

  const filtered = items.filter(i =>
    !query.trim() ||
    i.drug_name.toLowerCase().includes(query.toLowerCase()) ||
    i.generic_name?.toLowerCase().includes(query.toLowerCase())
  );

  const selectedEntries = Object.entries(quantities);
  const total = selectedEntries.reduce((sum, [id, qty]) => {
    const item = items.find(i => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  async function placeOrder() {
    if (!coords || selectedEntries.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/pharmacy/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedEntries.map(([catalogue_id, quantity]) => ({ catalogue_id, quantity })),
          patient_lat: coords.lat,
          patient_lng: coords.lng,
          patient_address: address,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not create order. Please try again."); setSubmitting(false); return; }
      router.push(`/dashboard/book/medication/payment/${json.order_id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <LocationPicker onReady={onLocationReady} onReset={resetLocation} />

      {coords && loadingCatalogue && (
        <Card className="text-center text-ds-sm text-muted">Finding the nearest pharmacy…</Card>
      )}

      {coords && catalogueError && <Notice tone="danger">{catalogueError}</Notice>}

      {coords && !loadingCatalogue && !catalogueError && items.length > 0 && (
        <>
          {/* Pharmacy header */}
          <div>
            <Avatar name={pharmacyName} size="lg" tint="var(--tint-yellow)" />
            <h2 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{pharmacyName}</h2>
            <p className="mt-1 text-ds-sm text-muted">Pharmacy · Nearest to you</p>
            <VerifiedBadge className="mt-2.5">Verified partner pharmacy</VerifiedBadge>
          </div>

          <Card padded={false} className="px-5 py-1">
            <dl>
              {[
                ["Hours", pharmacy?.opening_hours],
                ["Delivery", pharmacy?.delivery_eta_minutes ? `Delivery in about ${pharmacy.delivery_eta_minutes} min` : null],
                ["Regulator", "PCN"],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[17px] font-bold text-navy">Medicines in stock</h3>
              <span className="text-ds-sm text-muted">Prices in Naira</span>
            </div>
            <label className="mb-1.5 flex h-[54px] items-center gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
              <Search size={20} className="flex-none text-navy" aria-hidden />
              <input
                className="min-w-0 flex-1 bg-transparent text-ds-control text-ink outline-none placeholder:text-muted"
                placeholder="Search a medicine"
                aria-label="Search a medicine"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>

            <Card padded={false} className="px-4 py-1">
              {filtered.map(item => {
                const qty = quantities[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-ds-sm text-ink">{item.drug_name}</b>
                      <small className="block truncate text-ds-xs text-muted">
                        {[item.strength, item.formulation].filter(Boolean).join(" · ") || item.generic_name}
                      </small>
                      <div className="mt-1.5">
                        {item.stock === "out"
                          ? <Pill tone="bad">Out of stock</Pill>
                          : item.stock === "low"
                            ? <Pill tone="warn">Low, {item.stock_left} left</Pill>
                            : <Pill tone="ok">In stock</Pill>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-ds-sm font-extrabold text-navy tabular-nums">{formatNaira(item.price)}</div>
                      <div className="mt-1.5">
                        {qty === 0 ? (
                          <button
                            type="button"
                            disabled={item.stock === "out"}
                            onClick={() => changeQty(item.id, 1)}
                            className={cx(
                              "min-h-9 rounded-xl border-[1.5px] border-accent bg-surface px-3 text-[13px] font-bold text-accent",
                              "disabled:cursor-not-allowed disabled:border-line disabled:text-disabled-fg",
                              focusRing,
                            )}
                          >
                            {item.stock === "out" ? "Unavailable" : "Add"}
                          </button>
                        ) : (
                          <Stepper
                            label={`Quantity of ${item.drug_name}`}
                            value={qty}
                            min={0}
                            max={item.stock_left ?? Infinity}
                            size="sm"
                            onChange={v => changeQty(item.id, v - qty)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-[18px] text-center text-ds-sm text-muted">No medicine by that name here.</p>
              )}
            </Card>
          </section>

          {selectedEntries.length > 0 && (
            <div className="sticky bottom-[76px] z-20 rounded-ds-lg border border-line bg-surface/95 p-3.5 shadow-ds backdrop-blur md:bottom-4">
              {error && <Notice tone="danger" className="mb-3">{error}</Notice>}
              <div className="flex items-center gap-3.5">
                <div>
                  <small className="inline-flex items-center gap-1 text-ds-2xs font-bold text-muted">
                    <ShoppingCart size={12} aria-hidden /> {selectedEntries.length} item{selectedEntries.length > 1 ? "s" : ""}
                  </small>
                  <b className="block text-[20px] tracking-[-0.01em] text-navy tabular-nums">{formatNaira(total)}</b>
                </div>
                <Button className="flex-1" onClick={placeOrder} disabled={submitting}>
                  {submitting ? "Placing order…" : "Continue order"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {coords && !loadingCatalogue && !catalogueError && items.length === 0 && (
        <Card className="text-center text-ds-sm text-muted">
          No over the counter medication is currently listed for the pharmacy nearest you.
        </Card>
      )}
    </div>
  );
}
