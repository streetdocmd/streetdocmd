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

/** One lab's share of an order, priced as the patient pays it */
export interface LabQuote {
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

/** Usually one lab. When no single lab offers every test, one part per lab (migration 073). */
export interface Quote {
  labs: LabQuote[];
  total: number;
}

export interface QuoteResult {
  quote: Quote | null;
  /** Tests no lab that serves this address offers */
  missing: string[];
}

interface Offer {
  lab_partner_id: string; lab_name: string; collection_fee: number; distance_km: number; rating: number; review_count: number;
  platform_test_id: string; lab_catalogue_id: string; price: number; lab_test_name: string;
  preparation: string | null; turnaround_hours: number | null; sample_type: string | null;
}

/**
 * How these tests get done at this location, and what the patient pays.
 * Labs the doctor chose (preferred: test id to lab id) are kept wherever they
 * still serve the address, and other tests go to a lab already involved when
 * it offers them. The rest are planned to use as few labs as possible: the lab
 * covering the most remaining tests each round, cheaper, better rated and
 * closer breaking ties. With no preferences and one lab offering everything,
 * that's simply the best single lab. Each lab's part goes ahead on its own.
 */
export async function quoteTests(
  admin: SupabaseClient, testIds: string[], lat: number, lng: number, method: "home" | "doctor" = "home",
  preferred: Record<string, string> = {},
): Promise<QuoteResult> {
  const ids = Array.from(new Set(testIds)).filter(Boolean);
  if (!ids.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return { quote: null, missing: [] };

  const [{ data: offers, error }, { data: platform }, rate] = await Promise.all([
    admin.rpc("investigation_offers", { p_test_ids: ids, p_lat: lat, p_lng: lng, p_collection: method }),
    admin.from("investigation_catalogue").select("id, test_name, test_code, preparation").in("id", ids),
    getServiceChargeRate(admin),
  ]);
  if (error) throw new Error(error.message);
  const names = new Map(((platform ?? []) as any[]).map(p => [p.id as string, p]));
  const all = ((offers ?? []) as any[]).map(o => ({ ...o, price: Number(o.price), collection_fee: Number(o.collection_fee ?? 0) })) as Offer[];

  const offered = new Set(all.map(o => o.platform_test_id));
  const missing = ids.filter(id => !offered.has(id)).map(id => names.get(id)?.test_name ?? "A test");
  if (missing.length) return { quote: null, missing };

  const byLab = new Map<string, Offer[]>();
  for (const o of all) byLab.set(o.lab_partner_id, [...(byLab.get(o.lab_partner_id) ?? []), o]);

  const remaining = new Set(ids);
  const picks: { lab: string; offers: Offer[] }[] = [];
  const take = (lab: string, offer: Offer) => {
    const pick = picks.find(p => p.lab === lab) ?? (picks.push({ lab, offers: [] }), picks[picks.length - 1]);
    pick.offers.push(offer);
    remaining.delete(offer.platform_test_id);
  };
  // 1. The doctor's choices
  for (const id of ids) {
    const offer = (byLab.get(preferred[id]) ?? []).find(o => o.platform_test_id === id);
    if (offer) take(offer.lab_partner_id, offer);
  }
  // 2. Labs already involved, cheapest first
  for (const id of Array.from(remaining)) {
    const offer = picks.flatMap(p => byLab.get(p.lab) ?? []).filter(o => o.platform_test_id === id).sort((a, b) => a.price - b.price)[0];
    if (offer) take(offer.lab_partner_id, offer);
  }
  // 3. As few new labs as possible
  while (remaining.size) {
    let best: { lab: string; offers: Offer[]; cost: number; rating: number; km: number } | null = null;
    for (const [lab, list] of Array.from(byLab.entries())) {
      if (picks.some(p => p.lab === lab)) continue;
      const covers = list.filter(o => remaining.has(o.platform_test_id));
      if (!covers.length) continue;
      const cost = covers.reduce((a, o) => a + o.price, 0) + covers[0].collection_fee;
      const better = !best
        || covers.length > best.offers.length
        || (covers.length === best.offers.length && (cost < best.cost
          || (cost === best.cost && (covers[0].rating > best.rating
            || (covers[0].rating === best.rating && covers[0].distance_km < best.km)))));
      if (better) best = { lab, offers: covers, cost, rating: covers[0].rating, km: covers[0].distance_km };
    }
    if (!best) break;
    for (const o of best.offers) take(best.lab, o);
  }

  const labs: LabQuote[] = picks.map(({ offers: list }) => {
    const first = list[0];
    const items: QuoteItem[] = list.map(i => ({
      platform_test_id: i.platform_test_id,
      test_name: names.get(i.platform_test_id)?.test_name ?? i.lab_test_name,
      test_code: names.get(i.platform_test_id)?.test_code ?? null,
      lab_catalogue_id: i.lab_catalogue_id,
      price: i.price,
      // The lab's own preparation note wins; the StreetdocMD one is the fallback
      preparation: i.preparation ?? names.get(i.platform_test_id)?.preparation ?? null,
      turnaround_hours: i.turnaround_hours ?? null,
      sample_type: i.sample_type ?? null,
    }));
    const tests_total = items.reduce((a, i) => a + i.price, 0);
    const service_charge = serviceChargeFor(tests_total + first.collection_fee, rate);
    return {
      lab_partner_id: first.lab_partner_id,
      lab_name: first.lab_name,
      rating: Number(first.rating ?? 0),
      review_count: Number(first.review_count ?? 0),
      distance_km: Number(first.distance_km ?? 0),
      items,
      tests_total,
      collection_fee: first.collection_fee,
      service_charge,
      total: tests_total + first.collection_fee + service_charge,
    };
  });
  return { quote: { labs, total: labs.reduce((a, l) => a + l.total, 0) }, missing: [] };
}

/** The order's snapshot of tests for one lab, as stored on investigation_orders.tests */
export function testsSnapshot(q: LabQuote) {
  return q.items.map(i => ({
    // Kept if the order is re-planned (a split order checked out again)
    preferred_lab_id: q.lab_partner_id,
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

/** Patient facing message when some tests can't be done near this address */
export function missingMessage(missing: string[]) {
  return `No partner lab near this address offers ${missing.join(", ")}. Try another address, or ask your doctor about an alternative.`;
}

const UNPAID_PARTS = ["draft", "awaiting_payment", "payment_failed"];

/**
 * Every test still to be paid for on this order: its own, plus those of any
 * unpaid parts a previous checkout split off (they're re-planned together).
 */
export async function orderTestIds(admin: SupabaseClient, order: { id: string; tests: unknown; group_id?: string | null }) {
  const all: any[] = Array.isArray(order.tests) ? [...order.tests] : [];
  const parts: string[] = [];
  if (order.group_id) {
    const { data } = await admin.from("investigation_orders").select("id, tests")
      .eq("group_id", order.group_id).neq("id", order.id).neq("payment_status", "paid").in("status", UNPAID_PARTS);
    for (const p of (data ?? []) as any[]) { if (Array.isArray(p.tests)) all.push(...p.tests); parts.push(p.id); }
  }
  // The lab the doctor chose for each test, if any
  const preferred: Record<string, string> = {};
  for (const t of all) if (t?.platform_test_id && t?.preferred_lab_id) preferred[t.platform_test_id] = t.preferred_lab_id;
  return { ids: Array.from(new Set(platformTestIds(all))), unpaidParts: parts, preferred };
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
