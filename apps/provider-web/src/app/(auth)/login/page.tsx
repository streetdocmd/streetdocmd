"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import AuthBrand from "@/components/AuthBrand";
import { partnerPortal } from "@/lib/onboarding";

const ADMIN_LOGIN_URL = "https://admin.streetdocmd.com/login";

// Signed in, but there's no provider profile behind this account: say which
// portal it belongs to instead of dropping the person on the registration form.
function notAProviderMessage(role: string | null): { text: string; portal?: boolean } {
  if (role === "admin") {
    return { text: "This is a StreetdocMD admin account, not a provider account. Sign in to the admin console instead.", portal: true };
  }
  if (role === "patient") {
    return { text: "This email has a patient account, but it isn't registered as a provider. To offer care, apply to join below with the same email and password." };
  }
  return { text: "This email isn't registered as a provider yet. Apply to join below." };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [portalLink, setPortalLink] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setPortalLink(false);
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(
        err.message.toLowerCase().includes("invalid login credentials")
          ? "That email and password don't match. Check them and try again, or reset your password."
          : err.message.toLowerCase().includes("email not confirmed")
            ? "Please confirm your email address first — check your inbox for the link."
            : err.message
      );
      setLoading(false);
      return;
    }
    const { data: provider } = await supabase
      .from("providers").select("id").eq("user_id", data.user.id).maybeSingle();
    if (!provider) {
      const { data: profile } = await supabase
        .from("users").select("role").eq("id", data.user.id).maybeSingle();
      // Facility staff sign in here too. A full page load: the portals are another app.
      const portal = partnerPortal(profile?.role);
      if (portal) { window.location.assign(portal); return; }
      await supabase.auth.signOut();
      const message = notAProviderMessage(profile?.role ?? null);
      setError(message.text);
      setPortalLink(!!message.portal);
      setLoading(false);
      return;
    }
    // /dashboard routes every provider to the right place for their
    // verification status (documents, pending review, or the dashboard).
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <AuthBrand subtitle="Provider Portal · Home healthcare, on demand" />

      <div className="card p-6 sm:p-8">
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Welcome back</h1>
        <p className="text-muted text-sm mb-6">Sign in to manage your visits and earnings</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs text-accent font-medium hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
              {portalLink && (
                <a href={ADMIN_LOGIN_URL} className="mt-1.5 block font-bold text-red-800 underline underline-offset-2">
                  Go to admin.streetdocmd.com
                </a>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted mb-3">New to StreetdocMD?</p>
          <Link
            href="/register"
            className="block w-full border border-accent text-accent font-medium py-2.5 rounded-xl text-sm hover:bg-accent-soft transition-colors"
          >
            Apply to join as a provider
          </Link>
        </div>
      </div>
    </div>
  );
}
