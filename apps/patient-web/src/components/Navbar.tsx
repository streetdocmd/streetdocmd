"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Heart, House, Search, User } from "lucide-react";
import { BottomTabBar, cx, focusRing, type TabItem } from "@/components/ds";
import NotificationBell from "./notifications/NotificationBell";
import ThemeButton from "@/components/theme/ThemeButton";
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

export default function Navbar({ userName, userId, photoUrl = null }: { userName: string; userId: string; photoUrl?: string | null }) {
  const pathname = usePathname() ?? "";
  // Home: the header sits on the hero's gradient until the page scrolls,
  // then takes its usual frosted background so content doesn't clash
  const home = pathname === "/dashboard";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const clear = home && !scrolled;

  return (
    <>
      {/* While a menu is open the header (and so its menus) rises above
          the page content */}
      <header className={cx(
        "sticky top-0 z-30 border-b transition-colors duration-200 has-[[aria-expanded=true]]:z-50",
        clear ? "border-transparent bg-transparent" : "border-line bg-surface/95 backdrop-blur",
      )}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/dashboard" className={cx("flex shrink-0 items-center rounded-ds-sm", focusRing)}>
            <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-11 w-auto dark:hidden" priority />
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="hidden h-11 w-auto dark:block" priority />
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
                    "flex items-center gap-2 rounded-pill px-2.5 py-2 text-ds-sm font-semibold transition-colors lg:px-3.5",
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
            <ThemeButton />
            <NotificationBell userId={userId} inboxHref="/dashboard/notifications" />
            <ProfileMenu userName={userName} photoUrl={photoUrl} />
          </div>
        </div>
      </header>

      {/* Mobile tab bar: no solid fill; the page's blue wash and the curves
          show behind it, fading up so content beneath stays out of the way */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-[linear-gradient(to_top,#E6F0FF_0%,#EEF5FF_76%,transparent_100%)] dark:bg-[linear-gradient(to_top,rgb(var(--c-page))_0%,rgb(var(--c-page))_76%,transparent_100%)]" />
        <img aria-hidden src="/images/home-curves-bottom.svg" alt=""
          className="pointer-events-none absolute bottom-0 right-0 h-full w-auto max-w-[70%] dark:opacity-25" />
        <BottomTabBar items={NAV} className="relative !border-t-0 !bg-transparent" />
      </div>
    </>
  );
}
