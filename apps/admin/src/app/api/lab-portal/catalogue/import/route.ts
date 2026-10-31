import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { matchTests, sharedTestId } from "@/lib/lab-tests";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(work)));
  return out;
}

// A lab's test list from a CSV (the browser parses the file).
//   { names: [...] }  checks each name against the shared list, changing nothing
//   { rows: [...] }   saves them: a test already on this lab's list is updated,
//                     anything else is added. same_as is a match the lab confirmed.
// Runs on the service role and only ever writes the caller's own lab_partner_id.
export async function POST(req: NextRequest) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Only a lab's own staff can edit its test menu." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminSupabase();

  const { data: mine } = await admin.from("investigation_catalogue")
    .select("id, platform_test_id, price").eq("lab_partner_id", partnerId);
  const onList = new Map(((mine ?? []) as any[]).filter(t => t.platform_test_id).map(t => [t.platform_test_id as string, t]));

  if (Array.isArray(body.names)) {
    const names: string[] = Array.from(new Set<string>(body.names.map((n: unknown) => String(n ?? "").trim()).filter(Boolean))).slice(0, MAX_ROWS);
    const checked = await inBatches(names, 10, async name => {
      const found = await matchTests(admin, name, 4);
      const exact = found.find(m => m.exact) ?? null;
      return {
        name,
        exact: exact && { id: exact.id, test_name: exact.test_name, onList: onList.has(exact.id) },
        suggestions: exact ? [] : found,
      };
    });
    return NextResponse.json({ results: checked });
  }

  const rows: any[] = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  if (!rows.length) return NextResponse.json({ error: "Nothing to import." }, { status: 400 });

  let added = 0, updated = 0, failed = 0;
  const now = new Date().toISOString();
  // One at a time: two rows in a file can resolve to the same shared test
  for (const r of rows) {
    const name = String(r.test_name ?? "").trim().slice(0, 200);
    const price = Number(r.price);
    const turnaround = r.turnaround_hours == null ? null : Number(r.turnaround_hours);
    if (!name || !Number.isFinite(price) || price <= 0 || (turnaround !== null && (!Number.isInteger(turnaround) || turnaround <= 0))) { failed++; continue; }

    const platformTestId = await sharedTestId(admin, name, r.same_as);
    if (!platformTestId) { failed++; continue; }

    const fields = {
      test_name: name,
      test_code: String(r.test_code ?? "").trim() || null,
      turnaround_hours: turnaround,
      sample_type: String(r.sample_type ?? "").trim() || null,
      home_collection: r.home_collection !== false,
      preparation: String(r.preparation ?? "").trim().slice(0, 500) || null,
    };
    const current = onList.get(platformTestId);
    if (current) {
      const { error } = await admin.from("investigation_catalogue")
        .update({ ...fields, price, ...(Number(current.price) !== price ? { price_updated_at: now } : {}) })
        .eq("id", current.id).eq("lab_partner_id", partnerId);
      if (error) failed++; else { updated++; current.price = price; }
    } else {
      const { data, error } = await admin.from("investigation_catalogue")
        .insert({ ...fields, price, active: true, scope: "lab_partner", lab_partner_id: partnerId, platform_test_id: platformTestId })
        .select("id").single();
      if (error || !data) failed++;
      else { added++; onList.set(platformTestId, { id: data.id, platform_test_id: platformTestId, price }); }
    }
  }
  return NextResponse.json({ added, updated, failed });
}
