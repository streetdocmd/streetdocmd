"use client";

import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ClipboardList, CalendarDays, Stethoscope, Building, Users,
  Wallet, ShieldAlert, FileText, FilePenLine, ListTree, FlaskConical, Pill,
  Hospital, Settings, ExternalLink, X, UserCog, ScrollText, ChartColumn, Star,
} from "lucide-react";
import { useSidebar } from "@/components/ui/SidebarContext";
import ComingSoonBadge from "@/components/ComingSoonBadge";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key into `counts` for a pending-work badge. */
  countKey?: "providers" | "facilities";
  external?: boolean;
  comingSoon?: boolean;
};

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard",          label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Onboarding",
    items: [
      { href: "/dashboard/providers",  label: "Provider verification", icon: Stethoscope, countKey: "providers" },
      { href: "/dashboard/facilities", label: "Facility applications", icon: Building,    countKey: "facilities" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/patients", label: "Patients", icon: Users },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/dashboard/labs",      label: "Lab investigations", icon: FlaskConical },
      { href: "/dashboard/pharmacy",  label: "Pharmacy orders",    icon: Pill },
      { href: "/dashboard/hospitals", label: "Hospitals",          icon: Hospital },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/dashboard/clinical-notes",            label: "Clinical notes", icon: FileText },
      { href: "/dashboard/clinical-notes/uncodified", label: "Uncodified Dx",  icon: FilePenLine },
      { href: "/dashboard/clinical-notes/catalogue",  label: "Dx catalogue",   icon: ListTree },
    ],
  },
  {
    label: "Finance & safety",
    items: [
      { href: "/dashboard/finance",      label: "Finance",      icon: Wallet },
      { href: "/dashboard/safeguarding", label: "Safeguarding", icon: ShieldAlert },
      { href: "/dashboard/reviews",      label: "Reviews",      icon: Star },
    ],
  },
  {
    label: "Partner portals",
    items: [
      { href: "/lab-portal/dashboard",      label: "Lab portal",      icon: FlaskConical, external: true },
      { href: "/pharmacy-portal/dashboard", label: "Pharmacy portal", icon: Pill,         external: true },
      { href: "/hospital-portal/dashboard", label: "Hospital portal", icon: Hospital,     external: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings",           icon: Settings },
      { href: "#team",               label: "Team & roles",       icon: UserCog,     comingSoon: true },
      { href: "#audit",              label: "Audit log",          icon: ScrollText,  comingSoon: true },
      { href: "#reports",            label: "Reports & analytics", icon: ChartColumn, comingSoon: true },
    ],
  },
];

const ALL_HREFS = NAV_SECTIONS.flatMap((s) => s.items.filter((i) => !i.comingSoon).map((i) => i.href));

export default function Sidebar({
  counts = {},
}: {
  counts?: Partial<Record<"providers" | "facilities", number>>;
}) {
  const path = usePathname();
  const { open, close } = useSidebar();

  // Longest matching href wins, so /dashboard/clinical-notes/uncodified
  // doesn't also highlight /dashboard/clinical-notes.
  const activeHref = ALL_HREFS
    .filter((href) => (href === "/dashboard" ? path === "/dashboard" : path === href || path.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={close} aria-hidden="true" />
      )}

      <aside
        className={`w-64 bg-navy-700 flex flex-col shrink-0 h-screen fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="px-5 h-16 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link href="/dashboard" onClick={close} className="flex flex-col">
            <Image
              src="/logo-white.png"
              alt="StreetdocMD"
              width={220}
              height={88}
              className="h-6 w-auto"
              priority
            />
            <span className="text-[11px] font-medium text-blue-300 mt-1 tracking-wide">Admin Console</span>
          </Link>
          <button onClick={close} aria-label="Close menu" className="md:hidden text-blue-300 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" aria-label="Admin navigation">
          {NAV_SECTIONS.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[11px] font-semibold text-blue-300/60 uppercase tracking-widest px-3 mb-1.5">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  if (item.comingSoon) {
                    return (
                      <li key={item.href}>
                        <span
                          aria-disabled="true"
                          title="Coming soon"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-blue-100/40 cursor-not-allowed select-none"
                        >
                          <Icon size={16} className="shrink-0" aria-hidden />
                          <span className="flex-1 truncate">{item.label}</span>
                          <ComingSoonBadge tone="dark" />
                        </span>
                      </li>
                    );
                  }
                  const active = item.href === activeHref;
                  const count = item.countKey ? counts[item.countKey] ?? 0 : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-blue-brand text-white shadow-sm"
                            : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon size={16} className={`shrink-0 ${active ? "text-white" : "text-blue-300"}`} aria-hidden />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 && (
                          <span
                            className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                              active ? "bg-white text-blue-brand" : "bg-amber-400 text-navy-900"
                            }`}
                            aria-label={`${count} awaiting review`}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                        {item.external && <ExternalLink size={13} className="text-blue-300/60 shrink-0" aria-hidden />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <SocialLinks variant="dark" className="mb-2" />
          <p className="text-xs text-blue-300/50">Care. Anywhere. Anytime.</p>
        </div>
      </aside>
    </>
  );
}
