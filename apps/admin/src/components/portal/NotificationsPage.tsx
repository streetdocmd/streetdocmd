import { requirePortalAccess } from "./access";
import { PageHeader } from "./ui";
import type { PortalType } from "./config";
import NotificationsCenter from "@/components/notifications/NotificationsCenter";

export default async function NotificationsPage({ type }: { type: PortalType }) {
  const access = await requirePortalAccess(type);
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="New orders, referrals and reviews. Choose how each one reaches you." />
      <NotificationsCenter userId={access.user.id} categories={["orders", "reviews"]} />
    </div>
  );
}
