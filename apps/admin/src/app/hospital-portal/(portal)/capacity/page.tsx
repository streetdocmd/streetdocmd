import Link from "next/link";
import { requirePortalAccess } from "@/components/portal/access";
import { Card, Notice, PageHeader } from "@/components/portal/ui";
import { createAdminSupabase } from "@/lib/supabase-server";
import { Pill } from "@/components/ds";
import CapacityClient, { type Ward } from "./CapacityClient";

export const dynamic = "force-dynamic";

export default async function HospitalCapacityPage() {
  const access = await requirePortalAccess("hospital");
  const services: string[] = Array.isArray(access.partner?.services) ? access.partner!.services : [];

  let wards: Ward[] = [];
  let tableMissing = false;
  if (access.partnerId) {
    const { data, error } = await createAdminSupabase()
      .from("hospital_ward_capacity")
      .select("id, ward_name, total_beds, free_beds, updated_at")
      .eq("hospital_partner_id", access.partnerId)
      .order("ward_name");
    // Before migration 058 is applied the table doesn't exist yet
    tableMissing = !!error;
    wards = (data ?? []) as Ward[];
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Capacity" description="Updated by the ward team. Patients and doctors see free beds when they look for a hospital." />

      {!access.partnerId ? (
        <Notice tone="blue">Capacity is kept by each hospital&apos;s own staff. Sign in with a hospital account to update it.</Notice>
      ) : tableMissing ? (
        <Notice tone="amber">Ward capacity isn&apos;t set up on the database yet. It will appear here once the latest update is applied.</Notice>
      ) : (
        <CapacityClient initial={wards} />
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-navy">Specialist clinics</h2>
          <Link href="/hospital-portal/account" className="text-ds-sm font-bold text-accent hover:underline">Edit</Link>
        </div>
        <Card className="px-4 py-1">
          {services.length ? services.map(s => (
            <div key={s} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="text-ds-sm text-ink">{s}</span>
              <Pill tone="ok">Open</Pill>
            </div>
          )) : (
            <p className="py-4 text-ds-sm text-muted">No clinics listed yet. Add the services you offer on your profile.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
