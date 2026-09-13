import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import PayForMedicationButton from "./PayForMedicationButton";

export default async function MedicationPaymentPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("prescription_orders")
    .select("*, pharmacy_partners(name)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .single();

  if (!order) redirect("/dashboard");
  if (order.payment_status === "paid") redirect(`/dashboard/medications/${params.id}`);

  const drugs = (order.drugs as any[]) ?? [];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Complete Payment</h1>

      <div className="card p-6 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Order Summary</h2>
        <p className="text-sm text-gray-500 mb-3">{order.pharmacy_partners?.name}</p>
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

      <div className="card p-6 mb-6 bg-amber-50 border-amber-100">
        <p className="text-sm text-amber-700">
          <span className="font-semibold">Note:</span> Payment is collected upfront. Your order will be prepared and dispatched for delivery once payment is confirmed.
        </p>
      </div>

      <PayForMedicationButton orderId={params.id} />
    </div>
  );
}
