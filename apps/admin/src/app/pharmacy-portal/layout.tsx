import type { ReactNode } from "react";

export const metadata = { title: "StreetdocMD Pharmacy Partner Portal" };

// The root layout owns <html>/<body>; signed-in pages get the portal shell
// from (portal)/layout.tsx, sign-in pages render their own.
export default function PharmacyPortalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
