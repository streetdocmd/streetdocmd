import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getRequestSupabase } from "@/lib/supabase-server";

// GET /api/bookings/:id/dispatch: the offer currently waiting on a provider,
// for the waiting screen's countdown. Patients can't read dispatch_queue
// directly; this returns only the deadline and the provider's first name.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: booking } = await admin.from("bookings").select("patient_id").eq("id", params.id).maybeSingle();
  if (!booking || booking.patient_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: offer } = await admin
    .from("dispatch_queue")
    .select("sent_at, expires_at, providers(name)")
    .eq("booking_id", params.id)
    .is("response", null)
    .gt("expires_at", new Date().toISOString())
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!offer) return NextResponse.json({ offer: null });
  const name: string = (offer as any).providers?.name ?? "";
  const first = name.replace(/^(dr|mr|mrs|ms|nurse)\.?\s+/i, "").split(" ")[0] || null;
  return NextResponse.json({
    offer: { sent_at: offer.sent_at, expires_at: offer.expires_at, provider_first_name: first, is_doctor: /^dr\.?\s/i.test(name) },
  });
}
