import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_TAKEN =
  "This phone number is already linked to another StreetdocMD account. Sign in with that account, or use a different number.";

async function getSignInClient() {
  const cookieStore = await cookies();
  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  const coreConsent = body.coreConsent === true;

  if (!name || !email || !body.phone || !password) {
    return NextResponse.json({ error: "Please fill in all the fields." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  // The UI already disables submit until this is checked — this is
  // defense-in-depth against a direct API call bypassing that.
  if (!coreConsent) {
    return NextResponse.json({ error: "You must accept the Privacy Policy consent to continue." }, { status: 400 });
  }

  const admin = createAdminSupabase();

  // users.phone is UNIQUE. Check up front so a clash gives a clear message
  // instead of a raw constraint error after the auth account is created.
  const { data: phoneOwner } = await admin.from("users").select("id").eq("phone", phone).maybeSingle();
  if (phoneOwner) {
    const { data: ownerAuth } = await admin.auth.admin.getUserById(phoneOwner.id);
    if ((ownerAuth?.user?.email ?? "").toLowerCase() !== email) {
      return NextResponse.json({ error: PHONE_TAKEN }, { status: 409 });
    }
  }

  let userId: string;
  let alreadySignedIn = false;

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (authErr) {
    const msg = authErr.message.toLowerCase();
    const isAlreadyExists = msg.includes("already") || msg.includes("exists") || msg.includes("registered");

    if (!isAlreadyExists) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    // Auth user exists — verify ownership by signing in with supplied credentials
    const signInClient = await getSignInClient();
    const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });

    if (signInErr) {
      return NextResponse.json({
        error: "An account with this email already exists. Please sign in instead, or use a different email.",
      }, { status: 409 });
    }

    userId = signInData.user.id;
    alreadySignedIn = true;
  } else {
    userId = authData.user.id;
  }

  // Ensure public.users row exists (idempotent)
  const { data: existingUser } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  const now = new Date().toISOString();
  if (!existingUser) {
    const { error: userErr } = await admin.from("users").insert({
      id: userId, name, phone, email, role: "patient",
      ndpr_consent: true,
      ndpr_consent_at: now,
      core_consent_accepted: true,
      core_consent_policy_version: PRIVACY_POLICY_VERSION,
    });
    if (userErr) {
      if (!alreadySignedIn) await admin.auth.admin.deleteUser(userId);
      console.error("[register] users insert failed:", userErr);
      const isDup = userErr.code === "23505";
      return NextResponse.json(
        { error: isDup ? PHONE_TAKEN : "We couldn't finish creating your account. Please try again." },
        { status: isDup ? 409 : 500 },
      );
    }
  } else {
    // Rare edge case (auth user already existed, e.g. a retried signup) —
    // they still just went through the consent-gated form, so record it
    // the same way rather than silently skipping.
    await admin.from("users").update({
      core_consent_accepted: true,
      core_consent_policy_version: PRIVACY_POLICY_VERSION,
    }).eq("id", userId);
  }

  const { error: consentErr } = await admin.from("consent_log").insert({
    patient_id: userId,
    consent_type: "core",
    action: "granted",
    policy_version: PRIVACY_POLICY_VERSION,
    context: "signup",
  });
  if (consentErr) console.error("[register] consent_log insert failed:", consentErr);

  let signedIn = alreadySignedIn;
  if (!alreadySignedIn) {
    const signInClient = await getSignInClient();
    const { error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });
    if (signInErr) console.error("[register] post-signup sign-in failed:", signInErr);
    signedIn = !signInErr;
  }

  // existing: the account was already fully set up — skip onboarding.
  return NextResponse.json({ ok: true, signedIn, existing: !!existingUser });
}
