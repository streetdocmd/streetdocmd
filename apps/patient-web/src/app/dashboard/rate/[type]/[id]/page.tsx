import { notFound, redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
import { RATEABLE, isFacilityType, loadRateableOrder } from "@/lib/facility-reviews";
import RateForm from "@/app/dashboard/book/rate/[id]/RateForm";

// Rate a delivered pharmacy order, a resulted lab order or a completed referral
export default async function RateFacilityPage({ params }: { params: { type: string; id: string } }) {
  if (!isFacilityType(params.type)) notFound();
  const type = params.type;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminSupabase();
  const order = await loadRateableOrder(admin, type, params.id, user.id);
  if (!order || !order.done) redirect("/dashboard/my-care");

  const { data: existing } = await admin
    .from("facility_reviews")
    .select("id")
    .eq("facility_type", type)
    .eq("order_id", params.id)
    .maybeSingle();
  if (existing) redirect("/dashboard/my-care");

  return (
    <div className="mx-auto max-w-lg">
      <TopBar title={`Rate the ${RATEABLE[type].noun}`} backHref="/dashboard/my-care" className="-mx-5 -mt-2 md:mx-0" />
      <p className="mb-4 text-ds-sm text-muted">
        {RATEABLE[type].question} <span className="font-bold text-ink">{order.facilityName}</span>?
      </p>
      <RateForm facility={{ type, orderId: params.id }} doneHref="/dashboard/my-care" />
      <p className="mt-3 text-ds-xs text-muted">Your rating and comment are shown to other patients without your name.</p>
    </div>
  );
}
