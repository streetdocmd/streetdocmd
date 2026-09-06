import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin
    .from("providers")
    .select("id, name, photo_url, specialty, profession, bio, rating, total_visits")
    .eq("referral_code", code)
    .eq("verification_status", "verified")
    .maybeSingle();

  if (!provider) return NextResponse.json({ error: "No provider found with that code" }, { status: 404 });

  return NextResponse.json(provider);
}
