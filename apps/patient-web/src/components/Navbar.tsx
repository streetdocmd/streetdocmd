"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Stethoscope, HeartPulse, CalendarCheck, FileText, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Book Care", icon: Stethoscope },
  { href: "/dashboard/my-care", label: "My Care", icon: HeartPulse },
  { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck },
  { href: "/dashboard/records", label: "Records", icon: FileText },
  { href: "/dashboard/profile", label: "Profile", icon: User },
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
    <>
      <header className="bg-navy-700 text-white border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center shrink-0">
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-7 w-auto" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-white text-navy-700" : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-brand flex items-center justify-center text-xs font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-blue-100">{userName}</span>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex items-center gap-1.5 text-sm text-blue-200 hover:text-white hover:bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 transition-colors"
            >
              <LogOut size={14} strokeWidth={2} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar — active tab lifts into a floating bubble */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-navy-700 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-end gap-1 h-16 pb-2 text-[11px] font-medium"
              >
                <span
                  className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-blue-brand ring-4 ring-navy-700 shadow-lg shadow-black/30 transition-all duration-300 ease-out ${
                    active ? "-top-5 w-12 h-12 opacity-100 scale-100" : "-top-1 w-12 h-12 opacity-0 scale-50 pointer-events-none"
                  }`}
                >
                  <Icon size={21} strokeWidth={2.25} className="text-white" />
                </span>
                <Icon
                  size={20}
                  strokeWidth={2}
                  className={`transition-opacity duration-200 ${active ? "opacity-0" : "opacity-100 text-blue-200"}`}
                />
                <span className={`transition-colors duration-200 ${active ? "text-white font-semibold" : "text-blue-200"}`}>
                  {label === "My Bookings" ? "Bookings" : label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
