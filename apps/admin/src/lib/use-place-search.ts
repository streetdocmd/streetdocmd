"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/places";

export interface PickedPlace { lat: number; lng: number; address: string }

/** Address suggestions as someone types, from the app's own /places route */
export function usePlaceSearch(endpoint: string, query: string) {
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Finished searches, so "no matches" never flashes while a search is on its way
  const [searchedFor, setSearchedFor] = useState("");
  const session = useRef("");
  if (!session.current) session.current = crypto.randomUUID();
  const q = query.trim();

  useEffect(() => {
    setFailed(false);
    if (q.length < 3) { setResults([]); setSearching(false); setSearchedFor(""); return; }
    setSearching(true);
    const stop = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}&session=${session.current}`, { signal: stop.signal });
        if (!res.ok) throw new Error("search failed");
        setResults((await res.json()).places ?? []);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setResults([]);
        setFailed(true);
      }
      setSearching(false);
      setSearchedFor(q);
    }, 300);
    return () => { clearTimeout(timer); stop.abort(); };
  }, [q, endpoint]);

  // Google suggestions have no coordinates until one is picked
  const locate = useCallback(async (place: Place): Promise<PickedPlace | null> => {
    const address = [place.label, place.detail].filter(Boolean).join(", ");
    if (place.lat != null && place.lng != null) return { lat: place.lat, lng: place.lng, address };
    const res = await fetch(`${endpoint}?id=${encodeURIComponent(place.id)}&session=${session.current}`).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    session.current = crypto.randomUUID();
    return json?.place ? { lat: json.place.lat, lng: json.place.lng, address: json.place.address || address } : null;
  }, [endpoint]);

  return { results, searching, failed, noMatches: !searching && !failed && searchedFor === q && q.length >= 3 && results.length === 0, locate };
}
