// Kept for older clients: ordering now starts a draft that the patient
// completes and pays for on its order page (see /api/investigations).
import { NextRequest } from "next/server";
import { POST as startOrder } from "@/app/api/investigations/route";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const forwarded = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ testIds: body.catalogueIds ?? body.testIds, notes: body.clinicalNotes ?? body.notes }),
  });
  return startOrder(forwarded);
}
