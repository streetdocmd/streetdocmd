import type { ReactNode } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

export const dynamic = "force-dynamic";

export default function PharmacyPortalShellLayout({ children }: { children: ReactNode }) {
  return <PortalLayout type="pharmacy">{children}</PortalLayout>;
}
