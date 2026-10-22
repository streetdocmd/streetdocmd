"use client";
import { useState, useRef, useEffect } from "react";
import SocialLinks from "@/components/SocialLinks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, ChevronDown, Stethoscope, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";

// Same account dropdown as patient-web, plus the provider's secondary links.
export default function ProfileMenu({
  userName,
  subtitle,
  showServices = false,
}: {
  userName: string;
  subtitle?: string;
  showServices?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full hover:bg-white/10 transition-colors p-1 pr-1.5 sm:pr-2"
      >
        <div className="w-8 h-8 rounded-full bg-blue-brand flex items-center justify-center text-xs font-semibold text-white shrink-0">
          {userName.charAt(0).toUpperCase() || "P"}
        </div>
        <ChevronDown size={14} className={`hidden sm:block text-blue-200 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 text-gray-900 py-1">
          <div className="px-3.5 py-2 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          <Link
            href="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <User size={15} className="text-gray-400" /> Profile & payouts
          </Link>
          <Link
            href="/dashboard/patients"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors md:hidden"
          >
            <Users size={15} className="text-gray-400" /> My patients
          </Link>
          {showServices && (
            <Link
              href="/dashboard/services"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors md:hidden"
            >
              <Stethoscope size={15} className="text-gray-400" /> My services
            </Link>
          )}
          <SocialLinks className="px-3.5 py-2 border-t border-gray-50" />
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            <LogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
