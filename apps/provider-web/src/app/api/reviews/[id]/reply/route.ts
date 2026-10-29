import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// POST /api/reviews/:id/reply: the provider replies once to a review of their
// own visit (migration 064). For transparency a reply can't be changed or
// removed afterwards; only admins can remove it. There is no client update
// policy on reviews, so this writes with the service role.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!reply) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  if (reply.length > 2000) return NextResponse.json({ error: "Keep your reply under 2,000 characters." }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const { data, error } = await admin
    .from("reviews")
    .update({ reply, replied_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("provider_id", provider.id)
    .is("reply", null)
    .select("id");
  if (error) return NextResponse.json({ error: "Couldn't save your reply. Please try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "This review already has a reply, or it couldn't be found." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
