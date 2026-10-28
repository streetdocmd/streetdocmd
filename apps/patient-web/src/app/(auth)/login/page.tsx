"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import AuthShell from "@/components/AuthShell";

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email address first — check your inbox for the link we sent.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("fetch")) return "Couldn't reach StreetdocMD. Check your internet connection and try again.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { setError(friendlyAuthError(error.message)); setLoading(false); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach StreetdocMD. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy mb-1">Welcome back</h1>
      <p className="text-muted text-sm mb-6">Sign in to book care</p>

      {justRegistered && (
        <div className="mb-4 rounded-ds-sm bg-success-bg px-4 py-3 text-ds-sm text-ink">
          Your account has been created. Sign in to continue.
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs text-accent font-bold hover:underline mb-1">
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
          <div role="alert" className="rounded-ds-sm bg-danger-bg px-4 py-3 text-ds-sm text-ink">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted mb-3">New to StreetdocMD?</p>
        <Link href="/register" className="btn-secondary w-full">
          Create a free account
        </Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
