import { ArrowDownLeft, Landmark } from "lucide-react";
import { requirePortalAccess } from "./access";
import { Card, EmptyState, Notice, PageHeader, formatDateTime, formatNaira } from "./ui";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Pill } from "@/components/ds";

interface Txn {
  id: string;
  title: string;
  at: string;
  amount: number;
  state: "held" | "released" | "value" | "pending";
}

const firstName = (n: string | null | undefined) => (n ?? "Patient").split(" ")[0];

// Pharmacy income: paid prescription orders, less StreetdocMD's commission.
// payment_status "paid" is held by StreetdocMD; "released" has been paid out.
async function pharmacyLedger(partnerId: string): Promise<Txn[]> {
  const { data } = await createAdminSupabase()
    .from("prescription_orders")
    .select("id, total_amount, commission_amount, payment_status, created_at, users!patient_id(name)")
    .eq("pharmacy_partner_id", partnerId)
    .in("payment_status", ["paid", "released"])
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((o: any) => ({
    id: o.id,
    title: `Order, ${firstName(o.users?.name)}`,
    at: o.created_at,
    amount: Number(o.total_amount ?? 0) - Number(o.commission_amount ?? 0),
    state: o.payment_status === "released" ? "released" : "held",
  }));
}

// Labs (migration 067): paid orders earn the lab's own prices for the tests
// plus its collection fee. Earnings are held until results are sent; orders
// from before payments existed are listed by their test value.
async function labLedger(partnerId: string): Promise<Txn[]> {
  const { data } = await createAdminSupabase()
    .from("investigation_orders")
    .select("id, status, tests, payment_status, lab_price_total, collection_fee, resulted_at, paid_at, ordered_at, users!patient_id(name)")
    .eq("lab_partner_id", partnerId)
    .in("status", ["lab_accepted", "collection_scheduled", "sample_collected", "in_transit", "received_at_lab", "analysis_in_progress",
      "results_uploaded", "doctor_review_pending", "reviewed", "follow_up_required", "completed"])
    .order("ordered_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((o: any) => {
    const tests: { test_name?: string; price?: number }[] = Array.isArray(o.tests) ? o.tests : [];
    const paid = o.payment_status === "paid";
    const done = ["results_uploaded", "doctor_review_pending", "reviewed", "follow_up_required", "completed"].includes(o.status);
    return {
      id: o.id,
      title: `${tests.length === 1 ? tests[0].test_name ?? "Test" : `${tests.length} tests`}, ${firstName(o.users?.name)}`,
      at: o.resulted_at ?? o.paid_at ?? o.ordered_at,
      amount: paid
        ? Number(o.lab_price_total ?? 0) + Number(o.collection_fee ?? 0)
        : tests.reduce((s, t) => s + Number(t.price ?? 0), 0),
      state: !paid ? "value" : done ? "held" : "pending",
    } as Txn;
  });
}

export default async function WalletPage({ type }: { type: "pharmacy" | "lab" }) {
  const access = await requirePortalAccess(type);
  if (!access.partnerId) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Wallet" />
        <Notice tone="blue">Each facility sees its own income here. Sign in with a facility account to view it.</Notice>
      </div>
    );
  }

  const txns = type === "pharmacy" ? await pharmacyLedger(access.partnerId) : await labLedger(access.partnerId);
  const sum = (s: Txn["state"]) => txns.filter(t => t.state === s).reduce((a, t) => a + t.amount, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = txns.filter(t => new Date(t.at).getTime() >= monthStart).reduce((a, t) => a + t.amount, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Wallet"
        description={type === "pharmacy" ? "Income from paid medicine orders, after the StreetdocMD commission." : "Income from paid test orders: your listed prices plus your collection fee."}
      />

      <div className="rounded-ds-lg p-5 text-white shadow-ds" style={{ background: "linear-gradient(135deg, #0E9F8E, #0B7C70)" }}>
        {(
          <>
            <small className="text-ds-xs font-semibold text-white/80">Held for you by StreetdocMD</small>
            <b className="mt-1 block text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{formatNaira(sum("held"))}</b>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3.5">
              {type === "pharmacy"
                ? <div><small className="block text-ds-xs text-white/75">Paid out to you</small><b className="tabular-nums">{formatNaira(sum("released"))}</b></div>
                : <div><small className="block text-ds-xs text-white/75">In progress</small><b className="tabular-nums">{formatNaira(sum("pending"))}</b></div>}
              <div><small className="block text-ds-xs text-white/75">This month</small><b className="tabular-nums">{formatNaira(thisMonth)}</b></div>
            </div>
          </>
        )}
      </div>

      <p className="text-ds-xs text-muted">
        {type === "pharmacy"
          ? "StreetdocMD settles held income to your registered business account. Each order shows its reference so you can match it."
          : "Income is held once results are sent, and StreetdocMD settles it to your registered business account. Orders still in progress are shown separately. Each order shows its reference."}
      </p>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-navy">Recent activity</h2>
          <span className="text-ds-sm text-muted">{txns.length} {txns.length === 1 ? "item" : "items"}</span>
        </div>
        {txns.length === 0 ? (
          <Card><EmptyState icon={Landmark} title="Nothing here yet" description={type === "pharmacy" ? "Paid orders will appear here." : "Completed tests will appear here."} /></Card>
        ) : (
          <Card className="px-4 py-1">
            {txns.map(t => (
              <div key={t.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[14px] bg-success-bg text-success">
                  <ArrowDownLeft size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-ds-sm text-ink">{t.title}</b>
                  <small className="text-ds-xs text-muted">{formatDateTime(t.at)} · Ref {t.id.slice(0, 8).toUpperCase()}</small>
                </div>
                <div className="text-right">
                  <b className="block text-ds-sm text-success tabular-nums">+{formatNaira(t.amount)}</b>
                  {t.state === "held" && <Pill tone="idle" className="mt-1">Held</Pill>}
                  {t.state === "pending" && <Pill tone="info" className="mt-1">In progress</Pill>}
                  {t.state === "released" && <Pill tone="ok" className="mt-1">Paid out</Pill>}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
