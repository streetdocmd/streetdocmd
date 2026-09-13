"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Stethoscope, HeartPulse, CalendarCheck, FileText, User } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

// Book Care (the primary action) is deliberately centered in this order —
// both the desktop nav and mobile tab bar share it, so the layout below
// (grid-cols-5) puts it in the middle slot on both.
const NAV = [
  { href: "/dashboard/my-care", label: "My Care", icon: HeartPulse },
  { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck },
  { href: "/dashboard", label: "Book Care", icon: Stethoscope },
  { href: "/dashboard/records", label: "Records", icon: FileText },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function Navbar({ userName, userId }: { userName: string; userId: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="bg-gradient-to-b from-navy-700 to-navy-800 text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.12)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center shrink-0">
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto" priority />
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

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <NotificationBell patientId={userId} />
            <span className="w-px h-6 bg-white/10 hidden sm:block" />
            <ProfileMenu userName={userName} />
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar — floating white pill, active tab lifts into
          a brand-blue circular bubble that overlaps the top edge */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-none">
        <nav className="pointer-events-auto bg-white rounded-2xl shadow-lg shadow-black/10 border border-gray-100">
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
                    className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full bg-blue-brand ring-4 ring-white shadow-lg shadow-blue-brand/40 transition-all duration-300 ease-out ${
                      active ? "-top-6 w-12 h-12 opacity-100 scale-100" : "-top-2 w-12 h-12 opacity-0 scale-50 pointer-events-none"
                    }`}
                  >
                    <Icon size={21} strokeWidth={2.25} className="text-white" />
                  </span>
                  <Icon
                    size={19}
                    strokeWidth={1.75}
                    className={`transition-opacity duration-200 ${active ? "opacity-0" : "opacity-100 text-gray-400"}`}
                  />
                  <span className={`transition-colors duration-200 ${active ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
                    {label === "My Bookings" ? "Bookings" : label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
