import { NextRequest, NextResponse } from "next/server";
import { doctorVisit } from "@/lib/investigation-access";

// GET /api/investigations/match?bookingId=&q=: tests whose name or another name
// for them is close to what the doctor typed ("did you mean"), best first.
export async function GET(req: NextRequest) {
  const v = await doctorVisit(req.nextUrl.searchParams.get("bookingId"));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ matches: [] });
  const { data } = await v.admin.rpc("investigation_match_tests_ranked", { p_query: q, p_limit: 5 });
  return NextResponse.json({ matches: (data ?? []).map((m: any) => ({ id: m.id, test_name: m.test_name, matched: m.matched })) });
}
