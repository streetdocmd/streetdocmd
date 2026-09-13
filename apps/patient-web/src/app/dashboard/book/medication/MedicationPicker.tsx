"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, ShoppingCart, Pill } from "lucide-react";
import { formatNaira } from "@/lib/shared";
import LocationPicker from "@/components/LocationPicker";

interface CatalogueItem {
  id: string;
  drug_name: string;
  generic_name: string | null;
  formulation: string | null;
  strength: string | null;
  price: number;
}

export default function MedicationPicker() {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");
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
      setPharmacyName(json.pharmacy.name);
      setItems(json.items ?? []);
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
        <div className="card p-6 text-center text-gray-500 text-sm">Finding the nearest pharmacy…</div>
      )}

      {coords && catalogueError && (
        <div className="card p-6 text-center border border-red-200 bg-red-50 text-red-600 text-sm">{catalogueError}</div>
      )}

      {coords && !loadingCatalogue && !catalogueError && items.length > 0 && (
        <>
          <div className="card p-4">
            <p className="text-xs text-gray-400 mb-0.5">Fulfilled by</p>
            <p className="text-sm font-semibold text-gray-900">{pharmacyName}</p>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search medication…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {filtered.map(item => {
              const qty = quantities[item.id] ?? 0;
              return (
                <div key={item.id} className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
                    <Pill size={18} className="text-blue-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.drug_name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[item.strength, item.formulation].filter(Boolean).join(" · ") || item.generic_name}
                    </p>
                    <p className="text-sm font-bold text-blue-brand mt-0.5">{formatNaira(item.price)}</p>
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => changeQty(item.id, 1)} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => changeQty(item.id, -1)}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{qty}</span>
                      <button
                        onClick={() => changeQty(item.id, 1)}
                        aria-label="Increase quantity"
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No medication matches your search.</p>
            )}
          </div>

          {selectedEntries.length > 0 && (
            <div className="card p-4 sticky bottom-2 shadow-card-md border-blue-mid">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 inline-flex items-center gap-1.5">
                  <ShoppingCart size={15} /> {selectedEntries.length} item{selectedEntries.length > 1 ? "s" : ""}
                </span>
                <span className="text-base font-bold text-blue-brand">{formatNaira(total)}</span>
              </div>
              {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
              <button onClick={placeOrder} disabled={submitting} className="btn-primary w-full">
                {submitting ? "Placing order…" : `Place Order · ${formatNaira(total)}`}
              </button>
            </div>
          )}
        </>
      )}

      {coords && !loadingCatalogue && !catalogueError && items.length === 0 && (
        <div className="card p-6 text-center text-gray-400 text-sm">
          No over-the-counter medication is currently listed for the pharmacy nearest you.
        </div>
      )}
    </div>
  );
}
