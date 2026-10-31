import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getPortalApiAccess } from "@/components/portal/access";
import { matchTests } from "@/lib/lab-tests";

export const dynamic = "force-dynamic";

// GET /api/lab-portal/catalogue/match?q=: tests on the shared list whose name,
// or another name for them, is close to what the lab typed (migration 073).
// The lab confirms "same test"; nothing is matched on similarity alone.
export async function GET(req: NextRequest) {
  const auth = await getPortalApiAccess("lab");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ matches: [] });
  return NextResponse.json({ matches: await matchTests(createAdminSupabase(), q) });
}
