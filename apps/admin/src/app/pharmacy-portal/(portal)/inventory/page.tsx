import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requirePortalAccess } from "@/components/portal/access";
import { Card } from "@/components/portal/ui";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Pill } from "@/components/ds";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

// Paid orders still waiting on the pharmacy, as the design's "Orders to pack"
const PACK_STATUSES = ["sent", "confirmed", "dispensing"];

export default async function InventoryPage() {
  const access = await requirePortalAccess("pharmacy");

  let toPack: any[] = [];
  if (access.partnerId) {
    const { data } = await createAdminSupabase()
      .from("prescription_orders")
      .select("id, status, drugs, users!patient_id(name)")
      .eq("pharmacy_partner_id", access.partnerId)
      .in("status", PACK_STATUSES)
      .order("created_at", { ascending: true })
      .limit(10);
    toPack = data ?? [];
  }

  return (
    <div className="space-y-8">
      <InventoryClient partnerId={access.partnerId} />

      {access.partnerId && (
        <section>
          <h2 className="mb-3 text-[17px] font-bold text-navy">Orders to pack</h2>
          <Card className="px-4 py-1">
            {toPack.length === 0 ? (
              <p className="py-4 text-ds-sm text-muted">Nothing waiting. New orders appear here once paid.</p>
            ) : toPack.map(o => {
              const drugs: { drug_name?: string; quantity?: number }[] = Array.isArray(o.drugs) ? o.drugs : [];
              const items = drugs.map(d => `${d.drug_name ?? "Item"}${d.quantity ? ` × ${d.quantity}` : ""}`).join(", ");
              return (
                <Link key={o.id} href={`/pharmacy-portal/dashboard/${o.id}`}
                  className="flex items-center gap-3 border-b border-line py-3 last:border-0 hover:bg-page/60">
                  <div className="min-w-0 flex-1">
                    <b className="block text-ds-sm text-ink">{o.users?.name ?? "Patient"}</b>
                    <small className="block truncate text-ds-xs text-muted">{items || "No items"}</small>
                  </div>
                  {o.status === "sent" ? <Pill tone="info">New</Pill> : <Pill tone="warn" icon={null}>Packing</Pill>}
                  <ChevronRight size={16} className="text-muted" aria-hidden />
                </Link>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
