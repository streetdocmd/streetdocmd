import { redirect } from "next/navigation";
import { getPortalAccess } from "@/components/portal/access";

export const dynamic = "force-dynamic";

// Approved staff go straight to the dashboard. Everyone else sees their
// status (under review, not approved, …), rendered by (portal)/layout.tsx.
export default async function HospitalPortalRoot() {
  const access = await getPortalAccess("hospital");
  if (access.status === "ok") redirect("/hospital-portal/dashboard");
  return null;
}
