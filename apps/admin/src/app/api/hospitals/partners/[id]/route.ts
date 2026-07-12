import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await (await auth).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const body = await req.json();
  const { error } = await admin.from("hospital_partners").update(body).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
