import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy-policy";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();

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
  const { name, email, phone, password, coreConsent } = await req.json();
  if (!name || !email || !phone || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  // The UI already disables submit until this is checked — this is
  // defense-in-depth against a direct API call bypassing that.
  if (!coreConsent) {
    return NextResponse.json({ error: "You must accept the Privacy Policy consent to continue." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  let userId: string;
  let alreadySignedIn = false;

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
        error: "An account with this email already exists. Please sign in, or use a different email to register.",
      }, { status: 409 });
    }

    userId = signInData.user.id;
    alreadySignedIn = true;
  } else {
    userId = authData.user.id;
  }

  // Ensure public.users row exists (idempotent)
  const { data: existingUser } = await admin.from("users").select("id").eq("id", userId).single();
  if (!existingUser) {
    const { error: userErr } = await admin.from("users").insert({
      id: userId, name, phone, role: "patient",
      core_consent_accepted: true,
      core_consent_policy_version: PRIVACY_POLICY_VERSION,
    });
    if (userErr) {
      if (!alreadySignedIn) await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
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

  await admin.from("consent_log").insert({
    patient_id: userId,
    consent_type: "core",
    action: "granted",
    policy_version: PRIVACY_POLICY_VERSION,
    context: "signup",
  });

  if (!alreadySignedIn) {
    const signInClient = await getSignInClient();
    await signInClient.auth.signInWithPassword({ email, password });
  }

  return NextResponse.json({ ok: true });
}