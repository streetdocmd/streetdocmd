// Server side address search for Nigeria. Google Places when GOOGLE_MAPS_API_KEY
// is set (the best Nigerian coverage, paid per use); otherwise Photon, free and
// built on OpenStreetMap, which allows searching as people type and copes with
// typos. If Google fails, Photon answers instead.

export interface Place {
  id: string;
  label: string;
  detail: string;
  /** null for Google suggestions: placeLocation() looks them up once one is picked */
  lat: number | null;
  lng: number | null;
}

const NIGERIA_BBOX = "2.6,4.2,14.7,13.9";

async function photon(q: string): Promise<Place[]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&bbox=${NIGERIA_BBOX}`, {
    cache: "no-store",
    headers: { "User-Agent": "StreetdocMD (contact@streetdocmd.com)" },
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const json = await res.json();
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const label = p.name || street || p.district || p.city || p.county || p.state;
    if (!label) continue;
    const detail = [p.name ? street : null, p.district, p.city, p.county, p.state]
      .filter(Boolean).filter((v, i, all) => v !== label && all.indexOf(v) === i).join(", ");
    const key = `${label}|${detail}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `osm:${f.properties?.osm_id ?? places.length}`, label, detail, lat, lng });
  }
  return places;
}

async function google(q: string, key: string, session: string): Promise<Place[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input: q, includedRegionCodes: ["ng"], sessionToken: session }),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const json = await res.json();
  return (json.suggestions ?? []).flatMap((s: any) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [{
      id: p.placeId as string,
      label: (p.structuredFormat?.mainText?.text ?? p.text?.text ?? "") as string,
      detail: (p.structuredFormat?.secondaryText?.text ?? "") as string,
      lat: null, lng: null,
    }];
  });
}

export async function searchPlaces(q: string, session: string): Promise<Place[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      return await google(q, key, session);
    } catch (e) {
      console.error("[places] Google search failed, using Photon:", (e as Error).message);
    }
  }
  return photon(q);
}

/** Where a Google suggestion is. The session ties it to its searches for billing. */
export async function placeLocation(id: string, session: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${encodeURIComponent(session)}`, {
    cache: "no-store",
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,formattedAddress" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (typeof json.location?.latitude !== "number") return null;
  return { lat: json.location.latitude, lng: json.location.longitude, address: json.formattedAddress ?? "" };
}
