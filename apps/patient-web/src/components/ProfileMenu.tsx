"use client";
import { useState, useRef, useEffect } from "react";
import SocialLinks from "@/components/SocialLinks";
import ThemeToggle from "@/components/theme/ThemeToggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function ProfileMenu({ userName }: { userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function signOut() {
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
        className="flex items-center gap-1 rounded-full hover:bg-page transition-colors p-1 pr-1.5 sm:pr-2"
      >
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <ChevronDown size={14} className={`hidden sm:block text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-line overflow-hidden z-50 text-ink py-1">
          <div className="px-3.5 py-2 border-b border-line">
            <p className="text-sm font-semibold text-ink truncate">{userName}</p>
          </div>
          <Link
            href="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink hover:bg-page transition-colors"
          >
            <User size={15} className="text-muted" /> Profile
          </Link>
          <div className="border-t border-line px-3.5 py-2.5">
            <p className="mb-1.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-muted">Appearance</p>
            <ThemeToggle />
          </div>
          <SocialLinks className="px-3.5 py-2 border-t border-line" />
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
