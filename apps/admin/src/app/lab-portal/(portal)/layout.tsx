import type { ReactNode } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

export const dynamic = "force-dynamic";

export default function LabPortalShellLayout({ children }: { children: ReactNode }) {
  return <PortalLayout type="lab">{children}</PortalLayout>;
}
