import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await (await auth).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { resolved, notes } = await req.json();

  const { error } = await admin.from("safeguarding_alerts").update({
    resolved,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  }).eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
