import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase } from "@/lib/supabase-server";
import { placeLocation, searchPlaces } from "@/lib/places";

export const dynamic = "force-dynamic";

// GET /api/places?q=: address suggestions for what someone is typing.
// GET /api/places?id=: where a picked suggestion is.
// Signed in only, so nobody else can spend the Google allowance.
export async function GET(req: NextRequest) {
  const { user } = await getRequestSupabase(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const session = (params.get("session") ?? "").slice(0, 64);
  const id = params.get("id");
  try {
    if (id) return NextResponse.json({ place: await placeLocation(id, session) });
    const q = (params.get("q") ?? "").trim().slice(0, 120);
    if (q.length < 3) return NextResponse.json({ places: [] });
    return NextResponse.json({ places: await searchPlaces(q, session) });
  } catch {
    return NextResponse.json({ error: "Address search isn't available right now." }, { status: 502 });
  }
}
