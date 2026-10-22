import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getPractitionerType,
  getProfession,
  PLATFORM_COMMISSION_RATE,
  PROVIDER_AGREEMENT_VERSION,
  SPECIALTIES,
} from "@streetdocmd/shared";

const clean = (s: string) => s.replace(/[^\x00-\xFF]/g, "").trim();
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

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

function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("users_phone_key") || (m.includes("duplicate") && m.includes("phone"))) {
    return "This phone number is already linked to another StreetdocMD account. Sign in with that account's email, or use a different phone number.";
  }
  return "We couldn't finish creating your account. Please try again, or contact contact@streetdocmd.com if this keeps happening.";
}

// Creates the auth user + users row + providers row with the service role, so
// it works whether or not "Confirm email" is enabled in Supabase Auth and no
// RLS policy can half-complete a registration. Used by provider-web and by
// the Expo provider app (which then signs in with the same credentials).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const name = str(body.name);
  const phone = str(body.phone);
  const specialty = str(body.specialty);
  const specialistField = str(body.specialist_field);
  const credentials = str(body.credentials);
  const licenseNumber = str(body.license_number);
  const yearsExperience = Math.min(Math.max(parseInt(str(body.years_experience)) || 0, 0), 70);
  const expectedRateRaw = str(body.expected_rate);
  const expectedRate = expectedRateRaw ? Number(expectedRateRaw) : null;
  const questions = str(body.questions).slice(0, 2000);

  if (!email || !password || !name || !phone || !specialty || !credentials) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Your password must be at least 8 characters." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }
  if (!(SPECIALTIES as readonly string[]).includes(specialty)) {
    return NextResponse.json({ error: "Please select your specialty." }, { status: 400 });
  }
  if (expectedRate !== null && (!Number.isFinite(expectedRate) || expectedRate < 0)) {
    return NextResponse.json({ error: "Please enter a valid amount per booking, or leave it blank." }, { status: 400 });
  }
  if (body.ndpr_consent !== true) {
    return NextResponse.json({ error: "Please accept the data protection notice to continue." }, { status: 400 });
  }

  // Derive the licensing body from the specialty server-side rather than
  // trusting a client-sent value — the specialty -> body mapping is the
  // single source of truth in @streetdocmd/shared.
  const practitionerType = getPractitionerType(specialty);
  if (practitionerType && !licenseNumber) {
    return NextResponse.json({ error: `Please enter your ${practitionerType.licenseLabel}.` }, { status: 400 });
  }
  if (practitionerType?.requiresSpecialistField && !specialistField) {
    return NextResponse.json({ error: "Please enter your specialist field." }, { status: 400 });
  }

  // The mobile app collects the Provider Service Agreement at registration;
  // provider-web collects it on the documents step instead (agreement_accepted
  // absent). The timestamp and commission rate are always set server-side.
  const agreementAccepted = body.agreement_accepted === true;
  if (agreementAccepted && body.agreement_version !== PROVIDER_AGREEMENT_VERSION) {
    return NextResponse.json({
      error: "The Provider Service Agreement has been updated. Please update the app (or register at provider.streetdocmd.com) and review it again.",
    }, { status: 409 });
  }
  const agreementFields = agreementAccepted
    ? {
        agreement_version: PROVIDER_AGREEMENT_VERSION,
        agreement_accepted_at: new Date().toISOString(),
        agreement_commission_rate: PLATFORM_COMMISSION_RATE * 100,
      }
    : {};

  const admin = createAdminSupabase();
  let userId: string;
  let alreadySignedIn = false;
  let createdAuthUser = false;

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

    // Auth user already exists — verify they own this account by signing in.
    // This also makes the route safe to retry after a half-finished attempt.
    const signInClient = await getSignInClient();
    const { data: signInData, error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });

    if (signInErr) {
      return NextResponse.json({
        error: "An account with this email already exists. If it's yours, sign in instead (or reset your password) — otherwise use a different email.",
      }, { status: 409 });
    }

    userId = signInData.user.id;
    alreadySignedIn = true;
  } else {
    userId = authData.user.id;
    createdAuthUser = true;
  }

  const rollback = async () => { if (createdAuthUser) await admin.auth.admin.deleteUser(userId); };
  const now = new Date().toISOString();

  // Ensure public.users row exists (idempotent). An existing row (e.g. the
  // person already has a patient account) keeps its role and details.
  const { data: existingUser } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
  if (!existingUser) {
    const { error: userErr } = await admin.from("users").insert({
      id: userId, name, phone, email, role: "provider", ndpr_consent: true, ndpr_consent_at: now,
    });
    if (userErr) {
      await rollback();
      return NextResponse.json({ error: friendlyDbError(userErr.message) }, { status: 400 });
    }
  } else {
    await admin.from("users").update({ ndpr_consent: true, ndpr_consent_at: now }).eq("id", userId);
  }

  // Ensure public.providers row exists (idempotent)
  const { data: existingProvider } = await admin.from("providers").select("id").eq("user_id", userId).maybeSingle();
  let providerId = existingProvider?.id as string | undefined;
  if (!providerId) {
    const { data: inserted, error: provErr } = await admin.from("providers").insert({
      user_id: userId,
      name,
      phone,
      specialty,
      profession: getProfession(specialty),
      specialist_field: practitionerType?.requiresSpecialistField ? specialistField : null,
      credentials,
      license_body: practitionerType?.licenseBody ?? null,
      license_number: practitionerType ? licenseNumber : null,
      years_experience: yearsExperience,
      ...agreementFields,
    }).select("id").single();
    if (provErr || !inserted) {
      console.error("[register] provider insert failed:", provErr?.message);
      await rollback();
      return NextResponse.json({ error: friendlyDbError(provErr?.message ?? "") }, { status: 500 });
    }
    providerId = inserted.id;

    if (expectedRate !== null || questions) {
      // Best effort — never block a registration on the feedback answers.
      const { error: answersErr } = await admin.from("provider_registration_answers").insert({
        provider_id: providerId,
        expected_rate: expectedRate,
        questions: questions || null,
      });
      if (answersErr) console.error("[register] could not store registration answers:", answersErr.message);
    }
  } else if (agreementAccepted) {
    await admin.from("providers").update(agreementFields).eq("id", providerId);
  }

  // Sign in if we haven't already (new user path) — sets the session cookie
  // for provider-web. The mobile app ignores cookies and signs in itself.
  let signedIn = alreadySignedIn;
  if (!alreadySignedIn) {
    const signInClient = await getSignInClient();
    const { error: signInErr } = await signInClient.auth.signInWithPassword({ email, password });
    signedIn = !signInErr;
  }

  return NextResponse.json({ ok: true, signedIn });
}
