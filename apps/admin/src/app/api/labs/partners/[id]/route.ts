import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server";

async function requireAdmin(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const admin = createAdminSupabase();
  const { error } = await admin.from("lab_partners").update(body).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminSupabase();
  const { error } = await admin.from("lab_partners").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
