"use client";

import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":           { title: "Operations Overview",  subtitle: "Platform health at a glance" },
  "/dashboard/bookings":  { title: "Bookings",             subtitle: "All consultation requests" },
  "/dashboard/providers": { title: "Provider Management",  subtitle: "Verification and performance" },
  "/dashboard/patients":  { title: "Patient Registry",     subtitle: "All registered patients" },
  "/dashboard/finance":   { title: "Finance",              subtitle: "Revenue, payouts, and withdrawals" },
};

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const meta = PAGE_TITLES[path] ?? { title: "StreetdocMD", subtitle: "" };
  const now = new Date().toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-gray-900">{meta.title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 hidden md:block">{now}</span>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full border border-green-100">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Platform Live
        </div>

        {/* User menu */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-white text-xs font-bold">
            S
          </div>
        </button>
      </div>
    </header>
  );
}
