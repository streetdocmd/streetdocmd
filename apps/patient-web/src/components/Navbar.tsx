"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, House, Search, User } from "lucide-react";
import { BottomTabBar, cx, focusRing, type TabItem } from "@/components/ds";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

// One list for the desktop header links and the mobile tab bar (the design's five tabs).
// Records is reached from Care.
const NAV: TabItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/dashboard/search", label: "Search", icon: Search },
  { href: "/dashboard/bookings", label: "Visits", icon: CalendarDays },
  { href: "/dashboard/my-care", label: "Care", icon: Heart },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, { href, exact }: TabItem) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar({ userName, userId }: { userName: string; userId: string }) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/dashboard" className={cx("flex shrink-0 items-center rounded-ds-sm", focusRing)}>
            <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto" priority />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(item => {
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

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <NotificationBell patientId={userId} />
            <ProfileMenu userName={userName} />
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <BottomTabBar items={NAV} className="fixed inset-x-0 bottom-0 z-30 md:hidden" />
    </>
  );
}
