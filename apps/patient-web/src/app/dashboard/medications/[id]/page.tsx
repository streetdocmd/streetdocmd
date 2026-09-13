import { redirect } from "next/navigation";
import Link from "next/link";
import { Pill, Truck, Phone } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import ConfirmDeliveryButton from "./ConfirmDeliveryButton";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  sent: "Sent to Pharmacy",
  confirmed: "Confirmed",
  dispensing: "Preparing Your Order",
  dispatched: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-blue-100 text-blue-800",
  dispensing: "bg-blue-100 text-blue-800",
  dispatched: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
  expired: "bg-gray-100 text-gray-600",
};

export default async function MedicationOrderPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("prescription_orders")
    .select("*, pharmacy_partners(name, phone)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!order) redirect("/dashboard");
  if (order.payment_status !== "paid" && order.status === "pending_payment") {
    redirect(`/dashboard/book/medication/payment/${params.id}`);
  }

  const { data: tracking } = await supabase
    .from("delivery_tracking")
    .select("*")
    .eq("prescription_order_id", params.id)
    .maybeSingle();

  const drugs = (order.drugs as any[]) ?? [];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Order</h1>
        <span className={`badge ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
            <Pill size={18} className="text-blue-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{order.pharmacy_partners?.name}</p>
            <p className="text-xs text-gray-400">{drugs.length} item{drugs.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <dl className="space-y-2 mb-3">
          {drugs.map((d, i) => (
            <div key={i} className="flex justify-between text-sm">
              <dt className="text-gray-600">{d.drug_name} × {d.quantity}</dt>
              <dd className="font-medium text-gray-900">{formatNaira(d.price)}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-gray-100 pt-3 flex justify-between">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-base font-bold text-blue-brand">{formatNaira(order.total_amount)}</span>
        </div>
      </div>

      {tracking && (order.status === "dispatched" || order.status === "delivered") && (
        <div className="card p-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Delivery</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
              <Truck size={18} className="text-blue-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{tracking.rider_name ?? "Rider assigned"}</p>
              {tracking.rider_phone && (
                <a href={`tel:${tracking.rider_phone}`} className="text-xs text-blue-brand inline-flex items-center gap-1 hover:underline">
                  <Phone size={11} /> {tracking.rider_phone}
                </a>
              )}
            </div>
          </div>
          {tracking.estimated_arrival && order.status === "dispatched" && (
            <p className="text-xs text-gray-500 mt-3">
              Estimated arrival: {new Date(tracking.estimated_arrival).toLocaleString("en-NG", { weekday: "long", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}

      {order.status === "dispatched" && <ConfirmDeliveryButton orderId={params.id} />}

      {order.status === "delivered" && tracking?.proof_of_delivery_url && (
        <a
          href={tracking.proof_of_delivery_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full inline-flex justify-center mb-4"
        >
          View Proof of Delivery
        </a>
      )}

      <Link href="/dashboard" className="text-sm text-blue-brand hover:underline">
        ← Back to Book Care
      </Link>
    </div>
  );
}
