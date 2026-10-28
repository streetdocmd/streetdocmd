"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-ds-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60 ${className}`}
    >
      <LogOut size={13} /> {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
