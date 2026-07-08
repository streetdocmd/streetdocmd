"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Book Care" },
  { href: "/dashboard/bookings", label: "My Bookings" },
  { href: "/dashboard/visits", label: "My Visits" },
  { href: "/dashboard/records", label: "Records" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default function Navbar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-navy-700 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-brand rounded-lg flex items-center justify-center">
            <span className="font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-lg hidden sm:block">StreetdocMD</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-white/20 text-white" : "text-blue-100 hover:bg-white/10"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-blue-100 hidden sm:block">{userName}</span>
          <button
            onClick={signOut}
            className="text-sm text-blue-200 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-white/10 flex overflow-x-auto scrollbar-hide">
        {NAV.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                active ? "text-white bg-white/20" : "text-blue-200 hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}