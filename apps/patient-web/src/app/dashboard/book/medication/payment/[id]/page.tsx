import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { formatNaira } from "@/lib/shared";
import { Card, TopBar } from "@/components/ds";
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
    <div className="mx-auto max-w-lg">
      <TopBar title="Review and pay" className="-mx-5 -mt-2 md:mx-0" />
      <div className="mb-4 flex gap-1.5" aria-hidden>
        <span className="h-[5px] flex-1 rounded bg-accent" />
        <span className="h-[5px] flex-1 rounded bg-accent" />
        <span className="h-[5px] flex-1 rounded bg-line" />
      </div>

      <Card padded={false} className="px-5 py-1">
        <dl>
          <Row label="Order" value="Medicine order" />
          {order.pharmacy_partners?.name && <Row label="Pharmacy" value={order.pharmacy_partners.name} />}
        </dl>
      </Card>

      <Card className="mt-3">
        <h2 className="mb-1 text-ds-control font-bold text-navy">Price</h2>
        <dl>
          {drugs.map((d, i) => (
            <Row key={i} label={`${d.drug_name} × ${d.quantity}`} value={d.out_of_stock ? "Not available" : formatNaira(d.price)} />
          ))}
          {Number(order.commission_amount ?? 0) > 0 && <Row label="Service charge" value={formatNaira(order.commission_amount)} />}
          <Row label="Total" value={formatNaira(order.total_amount)} bold />
        </dl>
      </Card>

      <PayForMedicationButton orderId={params.id} total={order.total_amount} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-line py-2.5 text-ds-sm last:border-b-0 ${bold ? "text-ds-md" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${bold ? "font-extrabold text-navy" : "font-bold text-ink"} tabular-nums`}>{value}</dd>
    </div>
  );
}
