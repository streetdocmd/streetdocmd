import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

// PATCH /api/reviews/:id: an admin hides a review (with a reason), shows it
// again, or removes the provider's or facility's reply ({ removeReply: true }).
// kind "provider" is a visit review (reviews), "facility" a pharmacy, lab or
// hospital review (facility_reviews). Hidden reviews drop out of the average
// through the rating triggers (migration 064).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const table = body.kind === "facility" ? "facility_reviews" : body.kind === "provider" ? "reviews" : null;
  if (!table) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (body.removeReply === true) {
    const { data, error } = await admin.from(table).update({ reply: null, replied_at: null }).eq("id", params.id).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (body.hidden && !reason) return NextResponse.json({ error: "Give a reason for hiding this review." }, { status: 400 });

  const { data, error } = await admin
    .from(table)
    .update(body.hidden
      ? { hidden: true, hidden_reason: reason, hidden_at: new Date().toISOString() }
      : { hidden: false, hidden_reason: null, hidden_at: null })
    .eq("id", params.id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
