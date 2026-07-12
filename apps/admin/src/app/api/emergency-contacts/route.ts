import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, role } = await req.json();
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("emergency_contacts").insert({ name, phone, role: role ?? "ops" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}