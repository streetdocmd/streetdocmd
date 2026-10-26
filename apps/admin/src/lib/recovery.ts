"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export type RecoveryStatus = "checking" | "confirm" | "verifying" | "ready" | "expired";

export const EXPIRED_MESSAGE =
  "This reset link has expired or has already been used. Reset links work once and expire after an hour, so request a new one and use the newest email.";

/**
 * Handles every way a Supabase password-reset email can land on a reset page:
 *  - ?token_hash=…&type=recovery (recommended email template): waits for the user to tap
 *    "Continue" before using the one-time token, so email security scanners that open
 *    links can't use it up first.
 *  - ?code=… (PKCE) or #access_token=… (implicit): exchanged automatically by the client.
 *  - ?error=… / #error=… (e.g. otp_expired): shown as "link expired" straight away.
 */
export function useRecoveryLink() {
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [tokenHash, setTokenHash] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const param = (k: string) => query.get(k) ?? hash.get(k);

    if (param("error") || param("error_code")) {
      setStatus("expired");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const th = query.get("token_hash");
    if (th) {
      setTokenHash(th);
      setStatus("confirm");
      return;
    }

    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });
    const timeout = setTimeout(() => setStatus(s => (s === "checking" ? "expired" : s)), 6000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  /** Uses the one-time token. Only call from a user action (button tap). */
  const continueReset = useCallback(async () => {
    if (!tokenHash) return;
    setStatus("verifying");
    const { error } = await createClient().auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    window.history.replaceState(null, "", window.location.pathname);
    setStatus(error ? "expired" : "ready");
  }, [tokenHash]);

  return { status, continueReset };
}
