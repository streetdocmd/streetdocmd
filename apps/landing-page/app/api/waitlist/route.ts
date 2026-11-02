import { NextRequest, NextResponse } from "next/server";
import { WAITLIST_ROLES } from "@/lib/waitlist";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// POST /api/waitlist: saves a sign-up from the Contact page. This is the landing
// page's only database call, so it talks to Supabase directly with the public
// key, which can only add rows to this one table (migration 077).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // A hidden field people never see. Bots that fill it get a normal reply and nothing is saved.
  if (body.website) return NextResponse.json({ ok: true });

  const full_name = text(body.full_name, 120);
  const email = text(body.email, 254).toLowerCase();
  const role = text(body.role, 30);
  if (!full_name || !EMAIL.test(email) || !WAITLIST_ROLES.some(r => r.value === role)) {
    return NextResponse.json({ error: "Please add your name, a valid email and who you are." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Waitlist: Supabase environment variables are not set");
    return NextResponse.json({ error: "Not available" }, { status: 503 });
  }

  const res = await fetch(`${url}/rest/v1/waitlist_signups`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      full_name,
      email,
      role,
      phone: text(body.phone, 30) || null,
      city: text(body.city, 100) || null,
      message: text(body.message, 2000) || null,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  // 409 is an email already on the list: same reply, so nobody can check who has joined
  if (res && (res.ok || res.status === 409)) return NextResponse.json({ ok: true });

  console.error("Waitlist: could not save a sign-up", res?.status);
  return NextResponse.json({ error: "Could not save" }, { status: 502 });
}
