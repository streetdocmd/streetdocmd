"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📋" },
  { href: "/dashboard/earnings", label: "Earnings", icon: "💰" },
  { href: "/dashboard/profile", label: "Profile", icon: "👤" },
];

export default function Navbar({ providerName }: { providerName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="bg-navy-800 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">StreetdocMD</span>
          <span className="text-navy-100 text-xs hidden sm:block">Provider</span>
        </div>
Streetdocmd2026.
Streetdocmd2026.
        <nav className="hidden sm:flex items-center gap-1">
          {NAV.map(item => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-navy-700 text-white"
                    : "text-navy-100 hover:bg-navy-700 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-navy-100 hidden sm:block">{providerName}</span>
          <button
            onClick={signOut}
            className="text-xs text-navy-100 hover:text-white border border-navy-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden flex border-t border-navy-700">
        {NAV.map(item => {
          const active = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                active ? "text-white" : "text-navy-100"
              }`}
            >
              <span className="text-lg leading-none mb-0.5">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}