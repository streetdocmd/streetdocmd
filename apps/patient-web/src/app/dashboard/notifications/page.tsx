import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
import NotificationsCenter from "@/components/notifications/NotificationsCenter";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl">
      <TopBar title="Notifications" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      <NotificationsCenter userId={user.id} categories={["visits", "orders", "payments"]} />
    </div>
  );
}
