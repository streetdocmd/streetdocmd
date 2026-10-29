import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { PORTALS, type PortalType } from "@/components/portal/config";

export const dynamic = "force-dynamic";

// POST /api/facility/reviews/:id/reply?type=pharmacy|lab|hospital
// A facility replies to a review of its own service, or clears the reply
// with an empty string (facility_reviews, migration 064).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const type = req.nextUrl.searchParams.get("type") as PortalType;
  if (!(type in PORTALS)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const auth = await getPortalApiAccess(type);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Replies come from the facility's own staff." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (reply.length > 2000) return NextResponse.json({ error: "Keep your reply under 2,000 characters." }, { status: 400 });

  const { data, error } = await createAdminSupabase()
    .from("facility_reviews")
    .update({ reply: reply || null, replied_at: reply ? new Date().toISOString() : null })
    .eq("id", params.id)
    .eq("facility_type", type)
    .eq("facility_id", partnerId)
    .select("id");
  if (error) return NextResponse.json({ error: "Couldn't save your reply. Please try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
