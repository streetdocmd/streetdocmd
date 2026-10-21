"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Stethoscope, Building, Wallet, ShieldCheck, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/ui/PasswordInput";
import { Spinner } from "@/components/ui/ConfirmModal";

const NOT_ADMIN_MESSAGE =
  "That account doesn't have access to the admin console. Partner staff should use their lab, pharmacy or hospital portal.";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sent here by the dashboard guard: the session belongs to a non-admin
  // account. Clear it so the next sign-in starts clean.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "not_admin") {
      setError(NOT_ADMIN_MESSAGE);
      createClient().auth.signOut();
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setError(error?.message ?? "Sign-in failed. Please try again.");
      setLoading(false);
      return;
    }

    // users_self_read RLS lets a user read their own row.
    const { data: profile } = await supabase.from("users").select("role").eq("id", data.user.id).maybeSingle();
    if (profile?.role !== "admin") {
      await supabase.auth.signOut();
      setError(NOT_ADMIN_MESSAGE);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border-2 border-white" />
          <div className="absolute top-1/3 left-1/3 w-[28rem] h-[28rem] rounded-full border border-white" />
          <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full border-2 border-white" />
        </div>

        <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-8 w-auto relative" priority />

        <div className="relative max-w-md">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">Admin Console</p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Verify providers, approve partners, and run operations in one place.
          </h1>
          <ul className="mt-10 space-y-4">
            {[
              { icon: Stethoscope, text: "Provider credential verification" },
              { icon: Building,    text: "Lab, pharmacy and hospital onboarding" },
              { icon: Wallet,      text: "Payouts and financial oversight" },
              { icon: ShieldCheck, text: "Safeguarding and clinical quality" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-blue-100">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-blue-300/70 text-xs tracking-widest uppercase">Care. Anywhere. Anytime.</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-xl border border-gray-100 shadow-card flex items-center justify-center overflow-hidden">
              <Image src="/mark.jpg" alt="" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <p className="text-lg font-bold text-navy-700 leading-tight">StreetdocMD</p>
              <p className="text-xs text-gray-500">Admin Console</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in with your StreetdocMD staff account.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@streetdocmd.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-blue-brand font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading && <Spinner />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-8 inline-flex items-center justify-center gap-1.5 w-full">
            <Lock size={12} aria-hidden />
            Restricted to authorised StreetdocMD staff
          </p>
        </div>
      </div>
    </div>
  );
}
