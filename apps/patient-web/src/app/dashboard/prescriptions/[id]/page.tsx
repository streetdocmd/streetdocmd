import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
import PrescriptionReview from "./PrescriptionReview";

const OPEN = ["sent", "pending_payment", "confirmed", "dispensing", "dispatched", "delivered"];

export default async function PrescriptionPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prescription } = await supabase
    .from("prescriptions")
    .select("id, drugs, created_at, providers(name)")
    .eq("id", params.id)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!prescription) notFound();

  // Already with a pharmacy: show that order instead
  const { data: orders } = await supabase
    .from("prescription_orders")
    .select("id, status")
    .eq("prescription_id", params.id)
    .order("created_at", { ascending: false });
  const open = (orders ?? []).find(o => OPEN.includes(o.status));
  if (open) redirect(`/dashboard/medications/${open.id}`);

  const drugs = ((prescription.drugs ?? []) as any[]).map(d => ({
    name: String(d.name ?? d.drug_name ?? "Medicine"),
    detail: [d.dosage, d.frequency, d.duration].filter(Boolean).join(" · "),
  }));

  return (
    <div className="mx-auto max-w-lg">
      <TopBar title="Your prescription" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      <PrescriptionReview
        id={params.id}
        drugs={drugs}
        doctor={(prescription.providers as any)?.name ?? null}
        retry={(orders ?? []).some(o => o.status === "cancelled")}
      />
    </div>
  );
}
