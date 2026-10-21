import { requirePortalAccess } from "@/components/portal/access";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const access = await requirePortalAccess("pharmacy");
  return <InventoryClient partnerId={access.partnerId} />;
}
