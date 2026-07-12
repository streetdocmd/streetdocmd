"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const STATUS_LABELS: Record<string, string> = {
  ordered:                    "Order Placed",
  confirmed:                  "Confirmed",
  sample_collector_dispatched:"Collector Dispatched",
  sample_collected:           "Sample Collected",
  processing:                 "Processing",
  resulted:                   "Resulted",
};

const STATUS_COLOR: Record<string, string> = {
  ordered:                    "bg-yellow-100 text-yellow-700",
  confirmed:                  "bg-blue-100 text-blue-700",
  sample_collector_dispatched:"bg-indigo-100 text-indigo-700",
  sample_collected:           "bg-purple-100 text-purple-700",
  processing:                 "bg-orange-100 text-orange-700",
  resulted:                   "bg-green-100 text-green-700",
};

interface Order {
  id: string;
  status: string;
  ordered_at: string;
  tests: { test_name: string; price: number }[];
  clinical_notes: string;
  users: { name: string; phone: string } | null;
  providers: { name: string } | null;
}

export default function LabPortalDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [labPartnerId, setLabPartnerId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    setRole(profile?.role ?? "");

    let partnerId: string | null = null;
    if (profile?.role === "lab_staff") {
      const { data: staff } = await supabase
        .from("lab_staff")
        .select("lab_partner_id")
        .eq("user_id", user.id)
        .single();
      partnerId = staff?.lab_partner_id ?? null;
      setLabPartnerId(partnerId);
    }

    await loadOrders(partnerId, profile?.role ?? "");

    // Real-time subscription
    const channel = supabase
      .channel("lab-portal-orders")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "investigation_orders",
        ...(partnerId ? { filter: `lab_partner_id=eq.${partnerId}` } : {}),
      }, () => loadOrders(partnerId, profile?.role ?? ""))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  async function loadOrders(partnerId: string | null, userRole: string) {
    const supabase = createClient();
    let query = supabase
      .from("investigation_orders")
      .select(`
        id, status, ordered_at, tests, clinical_notes,
        users!patient_id(name, phone),
        providers(name)
      `)
      .order("ordered_at", { ascending: false });

    if (userRole === "lab_staff" && partnerId) {
      query = query.eq("lab_partner_id", partnerId);
    }

    const { data } = await query;
    setOrders((data as unknown as Order[]) ?? []);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  const pending = orders.filter(o => o.status !== "resulted");
  const resulted = orders.filter(o => o.status === "resulted");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Investigation Orders</h1>
        <div className="flex gap-3 text-sm">
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
            {pending.length} pending
          </span>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
            {resulted.length} resulted
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🧪</p>
          <p className="font-semibold text-gray-700">No orders yet</p>
          <p className="text-gray-400 text-sm mt-1">New orders will appear here in real time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/lab-portal/dashboard/${order.id}`}
              className="card p-5 flex items-start justify-between hover:shadow-card-md transition-shadow block"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(order.ordered_at).toLocaleDateString("en-NG", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
                <p className="font-semibold text-gray-900">
                  {(order.users as any)?.name ?? "Patient"} · ordered by Dr {(order.providers as any)?.name ?? "Provider"}
                </p>
                <p className="text-sm text-gray-500">
                  {order.tests?.map((t) => t.test_name).join(", ")}
                </p>
                {order.clinical_notes && (
                  <p className="text-xs text-gray-400 italic">"{order.clinical_notes}"</p>
                )}
              </div>
              <span className="text-gray-400 shrink-0 ml-4">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
