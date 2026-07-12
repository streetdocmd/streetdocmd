export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestPartner<T extends { lat?: number | null; lng?: number | null }>(
  partners: T[],
  lat: number,
  lng: number
): T | null {
  if (!partners.length) return null;
  let best = partners[0];
  let bestDist = haversineKm(lat, lng, best.lat ?? 0, best.lng ?? 0);
  for (let i = 1; i < partners.length; i++) {
    const d = haversineKm(lat, lng, partners[i].lat ?? 0, partners[i].lng ?? 0);
    if (d < bestDist) { best = partners[i]; bestDist = d; }
  }
  return best;
}
