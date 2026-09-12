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

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-navy-700 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-white" : "text-blue-200"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {label === "My Bookings" ? "Bookings" : label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
