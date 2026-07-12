import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "StreetdocMD Pharmacy Portal" };

export default function PharmacyPortalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">💊</div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">StreetdocMD</p>
              <p className="text-blue-600 text-xs">Pharmacy Partner Portal</p>
            </div>
          </div>
          <Link href="/pharmacy-portal/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Dashboard</Link>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
