"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, CalendarCheck, CalendarDays, Users, Stethoscope, Wallet, User, type LucideIcon,
} from "lucide-react";
import type { Profession } from "@streetdocmd/shared";
import ProfileMenu from "./ProfileMenu";

interface NavItem { href: string; label: string; short?: string; icon: LucideIcon; mobile: boolean }

const HOME: NavItem = { href: "/dashboard", label: "Home", icon: Home, mobile: true };
const BOOKINGS: NavItem = { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck, mobile: true };
const CALENDAR: NavItem = { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, mobile: true };
const PATIENTS: NavItem = { href: "/dashboard/patients", label: "My Patients", short: "Patients", icon: Users, mobile: false };
const SERVICES: NavItem = { href: "/dashboard/services", label: "Services", icon: Stethoscope, mobile: false };
const EARNINGS: NavItem = { href: "/dashboard/earnings", label: "Earnings", icon: Wallet, mobile: true };
const PROFILE: NavItem = { href: "/dashboard/profile", label: "Profile", icon: User, mobile: true };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export default function Navbar({
  providerName,
  specialty,
  profession,
}: {
  providerName: string;
  specialty?: string;
  profession?: Profession;
}) {
  const pathname = usePathname();

  // Doctor's bookable "services" are the fixed consultation types built into
  // booking already — only nurse/physio/lab manage their own service catalogue.
  const hasServices = !!profession && profession !== "doctor";
  const nav = hasServices
    ? [HOME, BOOKINGS, CALENDAR, PATIENTS, SERVICES, EARNINGS, PROFILE]
    : [HOME, BOOKINGS, CALENDAR, PATIENTS, EARNINGS, PROFILE];
  const mobileNav = nav.filter(i => i.mobile);
  // Encounter/note forms have their own fixed bottom action bar — the tab
  // bar would sit on top of it, so it steps aside on those focused flows.
  const focusedFlow = /^\/dashboard\/(clinical-note|nursing-note|physio-note)\//.test(pathname);

  return (
    <>
      <header className="bg-gradient-to-b from-navy-700 to-navy-800 text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.12)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto" priority />
            <span className="hidden sm:inline-block rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
              Provider
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {nav.filter(i => i !== PROFILE).map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-medium text-white">{providerName}</span>
              {specialty && <span className="block text-[11px] text-blue-200">{specialty}</span>}
            </span>
            <ProfileMenu userName={providerName} subtitle={specialty} showServices={hasServices} />
          </div>
        </div>

        {/* Tablet: secondary row so every section stays one tap away */}
        <nav className="hidden md:flex lg:hidden max-w-6xl mx-auto px-4 sm:px-5 pb-2 gap-1 overflow-x-auto">
          {nav.map(({ href, label, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-white text-navy-700" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={15} strokeWidth={2} />
                {short ?? label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Mobile bottom tab bar — same floating pill as patient-web */}
      {!focusedFlow && <div className="md:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-none">
        <nav className="pointer-events-auto bg-white rounded-2xl shadow-lg shadow-black/10 border border-gray-100">
          <div className="grid grid-cols-5">
            {mobileNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
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
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>}
    </>
  );
}
