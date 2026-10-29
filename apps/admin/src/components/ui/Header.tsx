"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useSidebar } from "@/components/ui/SidebarContext";

// Section + page names for the breadcrumb. Longest matching prefix wins.
const CRUMBS: [prefix: string, section: string, page: string][] = [
  ["/dashboard/bookings",                  "Operations", "Bookings"],
  ["/dashboard/calendar",                  "Operations", "Calendar"],
  ["/dashboard/providers",                 "Onboarding", "Provider verification"],
  ["/dashboard/facilities",                "Onboarding", "Facility applications"],
  ["/dashboard/patients",                  "People",     "Patients"],
  ["/dashboard/labs",                      "Partners",   "Lab investigations"],
  ["/dashboard/pharmacy",                  "Partners",   "Pharmacy orders"],
  ["/dashboard/hospitals",                 "Partners",   "Hospitals"],
  ["/dashboard/clinical-notes/uncodified", "Clinical",   "Uncodified Dx"],
  ["/dashboard/clinical-notes/catalogue",  "Clinical",   "Dx catalogue"],
  ["/dashboard/clinical-notes",            "Clinical",   "Clinical notes"],
  ["/dashboard/finance",                   "Finance",    "Finance"],
  ["/dashboard/safeguarding",              "Safety",     "Safeguarding"],
  ["/dashboard/settings",                  "System",     "Settings"],
];

function crumbFor(path: string) {
  const hit = CRUMBS.filter(([p]) => path === p || path.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  if (!hit) return { section: "Operations", page: "Overview" };
  return { section: hit[1], page: hit[2] };
}

function initials(name: string | null, email: string | null) {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "A";
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function Header({
  adminName = null,
  adminEmail = null,
  adminId = null,
}: {
  adminName?: string | null;
  adminEmail?: string | null;
  adminId?: string | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const { toggle } = useSidebar();
  const [signingOut, setSigningOut] = useState(false);

  const { section, page } = crumbFor(path);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white/95 backdrop-blur border-b border-gray-100 px-4 md:px-8 h-16 flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          aria-label="Open menu"
          className="md:hidden shrink-0 text-gray-500 hover:text-gray-900 p-1 -ml-1"
        >
          <Menu size={22} />
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-gray-400 hidden sm:inline">{section}</span>
          <ChevronRight size={14} className="text-gray-300 hidden sm:inline shrink-0" aria-hidden />
          <span className="font-semibold text-gray-900 truncate">{page}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {adminId && <NotificationBell userId={adminId} inboxHref="/dashboard/notifications" />}
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium text-gray-900">{adminName ?? "Admin"}</span>
          {adminEmail && <span className="text-xs text-gray-400">{adminEmail}</span>}
        </div>
        <div
          className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-white text-xs font-bold"
          aria-hidden
        >
          {initials(adminName, adminEmail)}
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
        >
          <LogOut size={15} aria-hidden />
          <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </header>
  );
}
