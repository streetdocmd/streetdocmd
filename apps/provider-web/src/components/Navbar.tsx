"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bell, CalendarDays, House, Stethoscope, User, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { Profession } from "@streetdocmd/shared";
import { BottomTabBar, cx, focusRing, type TabItem } from "@/components/ds";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeButton from "@/components/theme/ThemeButton";
import ProfileMenu from "./ProfileMenu";

interface NavItem extends TabItem { mobile: boolean }

// The design's five tabs (Today, Requests, Calendar, Wallet, Profile) on phones;
// desktop also links Patients and Rates.
const TODAY: NavItem = { href: "/dashboard", label: "Today", icon: House, exact: true, mobile: true };
const REQUESTS: NavItem = { href: "/dashboard/bookings", label: "Requests", icon: Bell, mobile: true };
const CALENDAR: NavItem = { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, mobile: true };
const PATIENTS: NavItem = { href: "/dashboard/patients", label: "Patients", icon: Users, mobile: false };
const SERVICES: NavItem = { href: "/dashboard/services", label: "Rates", icon: Stethoscope, mobile: false };
const WALLET: NavItem = { href: "/dashboard/earnings", label: "Wallet", icon: Wallet, mobile: true };
const PROFILE: NavItem = { href: "/dashboard/profile", label: "Profile", icon: User, mobile: true };

function isActive(pathname: string, { href, exact }: TabItem) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar({
  providerName,
  specialty,
  profession,
  userId,
  photoUrl = null,
}: {
  providerName: string;
  specialty?: string;
  profession?: Profession;
  /** Shows the notification bell */
  userId?: string;
  photoUrl?: string | null;
}) {
  const pathname = usePathname() ?? "";

  // Every individual provider sets their own services and fees
  const hasServices = !!profession;
  const nav = hasServices
    ? [TODAY, REQUESTS, CALENDAR, PATIENTS, SERVICES, WALLET, PROFILE]
    : [TODAY, REQUESTS, CALENDAR, PATIENTS, WALLET, PROFILE];
  // Encounter/note forms have their own fixed bottom action bar — the tab
  // bar would sit on top of it, so it steps aside on those focused flows.
  const focusedFlow = /^\/dashboard\/(clinical-note|nursing-note|physio-note)\//.test(pathname);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/dashboard" className={cx("flex shrink-0 items-center gap-2.5 rounded-ds-sm", focusRing)}>
            <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto dark:hidden" priority />
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="hidden h-9 w-auto dark:block" priority />
            <span className="rounded-md bg-teal-tint px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-teal-deep">
              Provider
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.filter(i => i !== PROFILE).map(item => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-2 rounded-pill px-3.5 py-2 text-ds-sm font-semibold transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-navy",
                    focusRing,
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeButton />
            {userId && <NotificationBell userId={userId} inboxHref="/dashboard/notifications" />}
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-ds-sm font-bold text-ink">{providerName}</span>
              {specialty && <span className="block text-ds-2xs text-muted">{specialty}</span>}
            </span>
            <ProfileMenu userName={providerName} subtitle={specialty} showServices={hasServices} photoUrl={photoUrl} />
          </div>
        </div>

        {/* Tablet: secondary row so every section stays one tap away */}
        <nav aria-label="Sections" className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-5 pb-2 md:flex lg:hidden">
          {nav.map(item => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-ds-sm font-semibold transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-navy",
                  focusRing,
                )}
              >
                <Icon size={15} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!focusedFlow && (
        <BottomTabBar items={nav.filter(i => i.mobile)} className="fixed inset-x-0 bottom-0 z-30 md:hidden" />
      )}
    </>
  );
}
