// Server helpers for investigation orders (migration 067). Every price is
// worked out here from the database; the browser only displays it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceChargeRate, serviceChargeFor } from "@/lib/service-charge";

export interface QuoteItem {
  platform_test_id: string;
  test_name: string;
  test_code: string | null;
  lab_catalogue_id: string;
  price: number;
  preparation: string | null;
  turnaround_hours: number | null;
  sample_type: string | null;
}

export interface Quote {
  lab_partner_id: string;
  lab_name: string;
  rating: number;
  review_count: number;
  distance_km: number;
  items: QuoteItem[];
  tests_total: number;
  collection_fee: number;
  service_charge: number;
  total: number;
}

/**
 * The best lab for these StreetdocMD tests at this location, with the
 * itemised price the patient pays: cheapest total first, then rating
 * (investigation_quote in migration 067). null when no lab can do them all.
 */
export async function quoteTests(
  admin: SupabaseClient, testIds: string[], lat: number, lng: number, method: "home" | "doctor" = "home",
): Promise<Quote | null> {
  const ids = Array.from(new Set(testIds)).filter(Boolean);
  if (!ids.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const [{ data: labs, error }, { data: platform }] = await Promise.all([
    admin.rpc("investigation_quote", { p_test_ids: ids, p_lat: lat, p_lng: lng, p_collection: method, p_exclude: [] }),
    admin.from("investigation_catalogue").select("id, test_name, test_code, preparation").in("id", ids),
  ]);
  if (error) throw new Error(error.message);
  const best = (labs ?? [])[0] as any;
  if (!best) return null;

  const names = new Map(((platform ?? []) as any[]).map(p => [p.id, p]));
  const items: QuoteItem[] = (best.items as any[]).map(i => ({
    platform_test_id: i.platform_test_id,
    test_name: names.get(i.platform_test_id)?.test_name ?? i.lab_test_name,
    test_code: names.get(i.platform_test_id)?.test_code ?? null,
    lab_catalogue_id: i.lab_catalogue_id,
    price: Number(i.price),
    // The lab's own preparation note wins; the StreetdocMD one is the fallback
    preparation: i.preparation ?? names.get(i.platform_test_id)?.preparation ?? null,
    turnaround_hours: i.turnaround_hours ?? null,
    sample_type: i.sample_type ?? null,
  }));

  const tests_total = items.reduce((a, i) => a + i.price, 0);
  const collection_fee = Number(best.collection_fee ?? 0);
  const rate = await getServiceChargeRate(admin);
  const service_charge = serviceChargeFor(tests_total + collection_fee, rate);
  return {
    lab_partner_id: best.lab_partner_id,
    lab_name: best.lab_name,
    rating: Number(best.rating ?? 0),
    review_count: Number(best.review_count ?? 0),
    distance_km: Number(best.distance_km ?? 0),
    items,
    tests_total,
    collection_fee,
    service_charge,
    total: tests_total + collection_fee + service_charge,
  };
}

/** The order's snapshot of tests, as stored on investigation_orders.tests */
export function testsSnapshot(q: Quote) {
  return q.items.map(i => ({
    catalogue_id: i.platform_test_id,
    platform_test_id: i.platform_test_id,
    lab_catalogue_id: i.lab_catalogue_id,
    test_name: i.test_name,
    test_code: i.test_code,
    price: i.price,
    preparation: i.preparation,
    sample_type: i.sample_type,
    turnaround_hours: i.turnaround_hours,
  }));
}

/** StreetdocMD test ids in an order's snapshot (platform_test_id, else a platform catalogue id) */
export function platformTestIds(tests: unknown): string[] {
  return (Array.isArray(tests) ? tests : [])
    .map((t: any) => t?.platform_test_id ?? null)
    .filter((x: unknown): x is string => typeof x === "string");
}

/** Moves an order through investigation_transition(); returns an error message or null */
export async function transition(admin: SupabaseClient, orderId: string, to: string, actorId: string | null, role: string, note?: string, data?: object) {
  const { data: res, error } = await admin.rpc("investigation_transition", {
    p_order: orderId, p_to: to, p_actor: actorId, p_role: role, p_note: note ?? null, p_data: data ?? {},
  });
  if (error) return error.message;
  return res === "ok" ? null : String(res);
}

/** A short lived link to a private file, or null */
export async function signedLink(admin: SupabaseClient, bucket: "lab-results" | "investigation-requests", path: string | null | undefined, seconds = 600) {
  if (!path) return null;
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
