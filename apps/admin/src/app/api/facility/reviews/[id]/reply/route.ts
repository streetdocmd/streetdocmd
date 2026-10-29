import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { PORTALS, type PortalType } from "@/components/portal/config";

export const dynamic = "force-dynamic";

// POST /api/facility/reviews/:id/reply?type=pharmacy|lab|hospital
// A facility replies once to a review of its own service (facility_reviews,
// migration 064). For transparency a reply can't be changed or removed
// afterwards; only admins can remove it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const type = req.nextUrl.searchParams.get("type") as PortalType;
  if (!(type in PORTALS)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const auth = await getPortalApiAccess(type);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const partnerId = auth.access.partnerId;
  if (!partnerId) return NextResponse.json({ error: "Replies come from the facility's own staff." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";
  if (!reply) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  if (reply.length > 2000) return NextResponse.json({ error: "Keep your reply under 2,000 characters." }, { status: 400 });

  const { data, error } = await createAdminSupabase()
    .from("facility_reviews")
    .update({ reply, replied_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("facility_type", type)
    .eq("facility_id", partnerId)
    .is("reply", null)
    .select("id");
  if (error) return NextResponse.json({ error: "Couldn't save your reply. Please try again." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "This review already has a reply, or it couldn't be found." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
