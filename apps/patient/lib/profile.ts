import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { recordLegalAcceptance, type LegalAcceptanceContext } from "./legal";

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

// Terms of Service acceptance + Privacy Policy acknowledgement to record
// once the row exists: the two boxes ticked at sign-up (deferred) or on the
// complete-profile screen, with the document versions shown at the time.
export type LegalAcceptanceToRecord = {
  context: Extract<LegalAcceptanceContext, "signup_deferred" | "complete_profile">;
  termsVersion: string;
  privacyVersion: string;
};

export async function createPatientProfile(
  userId: string,
  email: string | undefined,
  name: string,
  phone: string,
  legal: LegalAcceptanceToRecord | null,
): Promise<{ ok: boolean; error?: string }> {
  // No blanket "consent" flags: acknowledging the Privacy Policy is not
  // consent to processing. The legal columns are written only by the
  // record_patient_legal_acceptance RPC (migration 053 blocks direct writes).
  const { error } = await supabase.from("users").insert({
    id: userId,
    name,
    phone,
    email: email ?? null,
    role: "patient",
  });

  if (error) {
    if (error.code === "23505") {
      // Either the row already exists (a concurrent call won) or the phone
      // belongs to someone else.
      const { data: mine } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
      if (mine) {
        if (legal) await recordLegalAcceptance(legal.context, { terms: legal.termsVersion, privacy: legal.privacyVersion });
        return { ok: true };
      }
      return { ok: false, error: PHONE_TAKEN_MESSAGE };
    }
    console.warn("[profile] users insert failed", error);
    return { ok: false, error: "We couldn't finish setting up your account. Please try again." };
  }

  if (legal) {
    // If this fails the account still works; home asks them to accept
    // again (needsLegalAcceptance), so nothing is silently skipped.
    await recordLegalAcceptance(legal.context, { terms: legal.termsVersion, privacy: legal.privacyVersion });
  }
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
    // Current builds store the two separate sign-up ticks (and the versions
    // shown); older builds stored a single core_consent flag. Either way the
    // row can be created — but only the former is recorded as acceptance of
    // the Terms / acknowledgement of the Privacy Policy. Older sign-ups are
    // asked to accept on the home screen.
    const termsVersion = typeof meta.terms_version === "string" ? meta.terms_version : "";
    const privacyVersion = typeof meta.privacy_policy_version === "string" ? meta.privacy_policy_version : "";
    const accepted = meta.terms_accepted === true && meta.privacy_acknowledged === true && !!termsVersion && !!privacyVersion;
    if (!name || !phone || (!accepted && meta.core_consent !== true)) return { status: "missing" };

    const res = await createPatientProfile(
      userId, session.user.email, name, phone,
      accepted ? { context: "signup_deferred", termsVersion, privacyVersion } : null,
    );
    return res.ok ? { status: "present" } : { status: "missing", error: res.error };
  })();

  inFlight.set(userId, run);
  run.finally(() => inFlight.delete(userId));
  return run;
}
