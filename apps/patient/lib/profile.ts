import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Keep in sync with apps/patient-web/src/lib/privacy-policy.ts — the web
// dashboard compares users.core_consent_policy_version against it.
export const PRIVACY_POLICY_VERSION = "1.0";

export const PHONE_TAKEN_MESSAGE =
  "This phone number is already linked to another StreetdocMD account. Use a different number, or sign in with that account.";

export type ProfileStatus = { status: "present" } | { status: "missing"; error?: string };

// Lets the complete-profile screen tell the root layout to re-check after
// it creates the row, without threading state through expo-router.
const listeners = new Set<() => void>();
export function onProfileChanged(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function notifyProfileChanged() {
  listeners.forEach(fn => fn());
}

export async function createPatientProfile(
  userId: string,
  email: string | undefined,
  name: string,
  phone: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("users").insert({
    id: userId,
    name,
    phone,
    email: email ?? null,
    role: "patient",
    ndpr_consent: true,
    ndpr_consent_at: now,
    core_consent_accepted: true,
    core_consent_policy_version: PRIVACY_POLICY_VERSION,
  });

  if (error) {
    if (error.code === "23505") {
      // Either the row already exists (a concurrent call won) or the phone
      // belongs to someone else.
      const { data: mine } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
      if (mine) return { ok: true };
      return { ok: false, error: PHONE_TAKEN_MESSAGE };
    }
    console.warn("[profile] users insert failed", error);
    return { ok: false, error: "We couldn't finish setting up your account. Please try again." };
  }

  const { error: consentErr } = await supabase.from("consent_log").insert({
    patient_id: userId,
    consent_type: "core",
    action: "granted",
    policy_version: PRIVACY_POLICY_VERSION,
    context: "signup",
  });
  if (consentErr) console.warn("[profile] consent_log insert failed", consentErr);
  return { ok: true };
}

const inFlight = new Map<string, Promise<ProfileStatus>>();

// Every signed-in patient needs a public.users row (bookings, family
// members etc. all reference it). Sign-up stores name/phone/consent in the
// auth user's metadata, so the row can be created here on the first
// signed-in launch — including after email confirmation, when sign-up
// itself had no session to write with.
export function ensurePatientProfile(session: Session): Promise<ProfileStatus> {
  const userId = session.user.id;
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const run = (async (): Promise<ProfileStatus> => {
    const { data, error } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
    if (data) return { status: "present" };
    // Network/DB hiccup: don't bounce a real patient into setup.
    if (error) return { status: "present" };

    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const name = typeof meta.name === "string" ? meta.name.trim() : "";
    const phone = typeof meta.phone === "string" ? meta.phone.trim() : "";
    if (!name || !phone || meta.core_consent !== true) return { status: "missing" };

    const res = await createPatientProfile(userId, session.user.email, name, phone);
    return res.ok ? { status: "present" } : { status: "missing", error: res.error };
  })();

  inFlight.set(userId, run);
  run.finally(() => inFlight.delete(userId));
  return run;
}
