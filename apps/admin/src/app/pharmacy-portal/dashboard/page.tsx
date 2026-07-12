"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  sent:            "New Order",
  confirmed:       "Confirmed",
  dispensing:      "Dispensing",
  dispatched:      "Dispatched",
  delivered:       "Delivered",
  cancelled:       "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  sent:            "bg-blue-100 text-blue-700",
  confirmed:       "bg-purple-100 text-purple-700",
  dispensing:      "bg-orange-100 text-orange-700",
  dispatched:      "bg-teal-100 text-teal-700",
  delivered:       "bg-green-100 text-green-700",
  cancelled:       "bg-red-100 text-red-700",
};

export default function PharmacyDashboard() {
  const [orders, setOrders]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [filter, setFilter]       = useState<string>("active");

  useEffect(() => { init(); }, []);

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    let pid: string | null = null;
    if (profile?.role === "pharmacy_staff") {
      const { data: staff } = await supabase.from("pharmacy_staff").select("pharmacy_partner_id").eq("user_id", user.id).single();
      pid = staff?.pharmacy_partner_id ?? null;
      setPartnerId(pid);
    }

    await loadOrders(pid, profile?.role ?? "");

    const channel = supabase
      .channel("pharmacy-portal")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "prescription_orders",
        ...(pid ? { filter: `pharmacy_partner_id=eq.${pid}` } : {}),
      }, () => loadOrders(pid, profile?.role ?? ""))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  async function loadOrders(pid: string | null, role: string) {
    const supabase = createClient();
    let q = supabase
      .from("prescription_orders")
      .select(`id, status, total_amount, payment_status, requires_review, created_at, drugs, users!patient_id(name, phone), providers(name)`)
      .order("created_at", { ascending: false });
    if (role === "pharmacy_staff" && pid) q = q.eq("pharmacy_partner_id", pid);
    const { data } = await q;
    setOrders(data ?? []);
    setLoading(false);
  }

  const activeStatuses = ["sent", "confirmed", "dispensing", "dispatched"];
  const filtered = filter === "active"
    ? orders.filter(o => activeStatuses.includes(o.status))
    : filter === "delivered"
    ? orders.filter(o => o.status === "delivered")
    : orders;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Prescription Orders</h1>
        <div className="flex gap-2 text-sm">
          {[["active","Active"], ["delivered","Delivered"], ["all","All"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors ${filter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-3">💊</p><p className="font-semibold text-gray-700">No orders</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <Link key={o.id} href={`/pharmacy-portal/dashboard/${o.id}`}
              className="card p-5 flex items-start justify-between hover:shadow-card-md transition-shadow block">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                  {o.requires_review && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">⚠ Controlled Drug</span>}
                  <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString("en-NG", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}</span>
                </div>
                <p className="font-semibold text-gray-900">{(o.users as any)?.name ?? "Patient"} · Dr {(o.providers as any)?.name ?? "Provider"}</p>
                <p className="text-sm text-gray-500">{(o.drugs as any[])?.map((d:any) => d.drug_name).join(", ")}</p>
                {o.total_amount > 0 && <p className="text-sm font-medium text-gray-700">₦{Number(o.total_amount).toLocaleString()}</p>}
              </div>
              <span className="text-gray-400 shrink-0 ml-4">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
