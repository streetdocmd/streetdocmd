import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createAdminSupabase } from "@/lib/supabase-server";
import { buildCareReport } from "@/lib/care-report";

export const dynamic = "force-dynamic";

// GET /api/admin/journeys/:id/report: admins download any care journey's
// full report (with the care team conversation) as a PDF (migration 068).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  try {
    const pdf = await buildCareReport(createAdminSupabase(), params.id, "full");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="care-journey-${params.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
