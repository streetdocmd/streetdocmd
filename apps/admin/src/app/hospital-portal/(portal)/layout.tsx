import type { ReactNode } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

export const dynamic = "force-dynamic";

export default function HospitalPortalShellLayout({ children }: { children: ReactNode }) {
  return <PortalLayout type="hospital">{children}</PortalLayout>;
}
