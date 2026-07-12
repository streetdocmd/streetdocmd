import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["acknowledge", "resolve"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const now = new Date().toISOString();

  const update =
    action === "acknowledge"
      ? { status: "acknowledged", acknowledged_by: user.id, acknowledged_at: now }
      : { status: "resolved",     resolved_by:     user.id, resolved_at:     now };

  const { error } = await admin.from("emergencies").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}