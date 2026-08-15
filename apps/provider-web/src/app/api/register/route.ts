import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPractitionerType } from "@streetdocmd/shared";

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
  const body = await req.json();
  const { email, password, name, phone, specialty, credentials, license_number, years_experience } = body;

  if (!email || !password || !name || !phone || !specialty) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Derive the licensing body from the specialty server-side rather than
  // trusting a client-sent value — the specialty -> body mapping is the
  // single source of truth in @streetdocmd/shared.
  const practitionerType = getPractitionerType(specialty);
  if (practitionerType && !license_number) {
    return NextResponse.json({ error: `Missing ${practitionerType.licenseLabel}` }, { status: 400 });
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

    // Auth user already exists — verify they own this account by signing in
    const signInClient = await getSignInClient();
    const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });

    if (signInErr) {
      return NextResponse.json({
        error: "An account with this email already exists. If this is yours, please sign in — or use a different email to register.",
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
    const { error: userErr } = await admin.from("users").insert({ id: userId, name, phone, role: "provider" });
    if (userErr) {
      if (!alreadySignedIn) await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
  }

  // Ensure public.providers row exists (idempotent)
  const { data: existingProvider } = await admin.from("providers").select("id").eq("user_id", userId).single();
  if (!existingProvider) {
    const { error: provErr } = await admin.from("providers").insert({
      user_id: userId,
      name,
      phone,
      specialty,
      credentials,
      license_body: practitionerType?.licenseBody ?? null,
      license_number: practitionerType ? license_number : null,
      years_experience: parseInt(years_experience) || 0,
    });
    if (provErr) {
      if (!alreadySignedIn) await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: provErr.message }, { status: 500 });
    }
  }

  // Sign in if we haven't already (new user path)
  if (!alreadySignedIn) {
    const signInClient = await getSignInClient();
    await signInClient.auth.signInWithPassword({ email, password });
  }

  return NextResponse.json({ ok: true });
}