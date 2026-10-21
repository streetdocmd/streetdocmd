import { redirect } from "next/navigation";
import { getPortalAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// Approved staff go straight to the dashboard. Everyone else sees their
// status (under review, not approved, …), rendered by (portal)/layout.tsx.
export default async function LabPortalRoot() {
  const access = await getPortalAccess("lab");
  if (access.status === "ok") redirect("/lab-portal/dashboard");
  return null;
}
