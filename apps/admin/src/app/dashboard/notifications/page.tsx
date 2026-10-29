import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import NotificationsCenter from "@/components/notifications/NotificationsCenter";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Notifications</h1>
        <p className="mt-1 text-ds-sm text-muted">Alerts for verifications, facility applications, refunds, payouts and safeguarding.</p>
      </div>
      <NotificationsCenter userId={user.id} categories={["admin"]} />
    </div>
  );
}
