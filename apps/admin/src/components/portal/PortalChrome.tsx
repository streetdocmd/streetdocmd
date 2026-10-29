"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import SocialLinks from "@/components/SocialLinks";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2, ClipboardList, Package, Microscope, Settings, Wallet, BarChart3, Users, FileText,
  FolderLock, Bell, Plug, Menu, Star, X, ChevronDown, LogOut, Mail, type LucideIcon,
} from "lucide-react";
import { BottomTabBar } from "@/components/ds";
import { createClient } from "@/lib/supabase";
import { PORTALS, SUPPORT_MAILTO, type PortalType } from "./config";

interface NavItem { href: string; label: string; icon: LucideIcon }

// The design's facility tabs: the work queue, orders or referrals, wallet, reviews and profile
function navFor(type: PortalType): NavItem[] {
  const base = PORTALS[type].base;
  if (type === "lab") return [
    { href: `${base}/dashboard`, label: "Orders", icon: ClipboardList },
    { href: `${base}/tests`, label: "Tests", icon: Microscope },
    { href: `${base}/wallet`, label: "Wallet", icon: Wallet },
    { href: `${base}/reviews`, label: "Reviews", icon: Star },
    { href: `${base}/account`, label: "Profile", icon: Settings },
  ];
  if (type === "pharmacy") return [
    { href: `${base}/dashboard`, label: "Orders", icon: ClipboardList },
    { href: `${base}/inventory`, label: "Stock", icon: Package },
    { href: `${base}/wallet`, label: "Wallet", icon: Wallet },
    { href: `${base}/reviews`, label: "Reviews", icon: Star },
    { href: `${base}/account`, label: "Profile", icon: Settings },
  ];
  return [
    { href: `${base}/dashboard`, label: "Referrals", icon: FileText },
    { href: `${base}/capacity`, label: "Capacity", icon: Building2 },
    { href: `${base}/reviews`, label: "Reviews", icon: Star },
    { href: `${base}/account`, label: "Profile", icon: Settings },
  ];
}

// Planned partner features. Shown disabled, never with placeholder data.
function comingSoonFor(type: PortalType): { label: string; icon: LucideIcon }[] {
  const items = [
    { label: "Reports & analytics", icon: BarChart3 },
    { label: "Team members", icon: Users },
    { label: "Document vault", icon: FolderLock },
    { label: "Notification settings", icon: Bell },
    ...(type === "hospital" ? [{ label: "API & integrations", icon: Plug }] : []),
  ];
  return items;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ type, pathname, onNavigate }: { type: PortalType; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-6" aria-label="Portal">
      <ul className="space-y-1">
        {navFor(type).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-pill px-3.5 py-2 text-ds-sm font-semibold transition-colors ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-page hover:text-navy"
                }`}
              >
                <Icon size={17} aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div>
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Coming soon</p>
        <ul className="space-y-1">
          {comingSoonFor(type).map(({ label, icon: Icon }) => (
            <li key={label}>
              <span
                aria-disabled="true"
                title="Coming soon"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted cursor-not-allowed select-none"
              >
                <Icon size={17} aria-hidden />
                <span className="flex-1 truncate">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function UserMenu({ type, userName, userEmail, showAccount }: { type: PortalType; userName: string; userEmail: string | null; showAccount: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const base = PORTALS[type].base;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push(`${base}/login`);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full hover:bg-page transition-colors p-1 sm:pr-2"
      >
        <span className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
          {(userName || userEmail || "?").charAt(0).toUpperCase()}
        </span>
        <ChevronDown size={14} className={`hidden sm:block text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-line overflow-hidden z-50 text-ink py-1">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-ink truncate">{userName || "Signed in"}</p>
            {userEmail && <p className="text-xs text-muted truncate">{userEmail}</p>}
          </div>
          {showAccount && (
            <Link href={`${base}/account`} onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-page">
              <Settings size={15} className="text-muted" aria-hidden /> Account & password
            </Link>
          )}
          <a href={SUPPORT_MAILTO}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-page">
            <Mail size={15} className="text-muted" aria-hidden /> Contact support
          </a>
          <SocialLinks className="px-4 py-2 border-t border-line" />
          <button onClick={signOut} disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 border-t border-line">
            <LogOut size={15} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalChrome({
  type, userName, userEmail, facilityName, showNav, children,
}: {
  type: PortalType;
  userName: string;
  userEmail: string | null;
  facilityName: string | null;
  showNav: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cfg = PORTALS[type];

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  return (
    // .theme-provider: partner portals use the provider app's teal accent
    <div className="theme-provider min-h-screen flex flex-col bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 text-ink backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {showNav && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden -ml-1 p-2 rounded-lg text-navy hover:bg-page"
                aria-label="Open menu"
              >
                <Menu size={20} aria-hidden />
              </button>
            )}
            <Link href={cfg.base} className="flex items-center shrink-0">
              <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-8 w-auto" priority />
            </Link>
            <span className="hidden sm:block w-px h-6 bg-line" aria-hidden />
            <div className="hidden sm:block min-w-0 leading-tight">
              <p className="text-ds-sm font-bold text-ink truncate">{facilityName ?? cfg.name}</p>
              <p className="text-ds-2xs font-bold uppercase tracking-[0.04em] text-teal-deep truncate">{cfg.name}</p>
            </div>
          </div>
          <UserMenu type={type} userName={userName} userEmail={userEmail} showAccount={showNav} />
        </div>
      </header>

      <div className="flex-1 w-full max-w-7xl mx-auto flex">
        {showNav && (
          <aside className="hidden lg:block w-64 shrink-0 border-r border-line px-3 py-8">
            <div className="sticky top-24">
              <NavList type={type} pathname={pathname} />
            </div>
          </aside>
        )}
        <main className={`flex-1 min-w-0 px-5 sm:px-6 lg:px-8 py-6 sm:py-8 ${showNav ? "pb-28 md:pb-8" : ""}`}>{children}</main>
      </div>

      {showNav && (
        <BottomTabBar items={navFor(type)} className="fixed inset-x-0 bottom-0 z-30 md:hidden" />
      )}

      {showNav && drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-line">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{cfg.name}</p>
                {facilityName && <p className="text-xs text-muted truncate">{facilityName}</p>}
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-pending-bg text-muted" aria-label="Close menu">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">
              <NavList type={type} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
