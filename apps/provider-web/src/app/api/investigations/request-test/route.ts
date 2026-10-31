import { NextRequest, NextResponse } from "next/server";
import { doctorVisit } from "@/lib/investigation-access";

// POST /api/investigations/request-test { bookingId, testId? , name? }
// No lab near the patient offers this test. It isn't added to the patient's
// order; instead every lab is asked whether it offers it, and this doctor is
// told when one lists it (migration 073).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const v = await doctorVisit(body.bookingId);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });

  let testId: string | null = typeof body.testId === "string" ? body.testId : null;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!testId && name) {
    const { data, error } = await v.admin.rpc("investigation_platform_test", { p_name: name, p_requested: true });
    if (error) return NextResponse.json({ error: "Couldn't send the request. Please try again." }, { status: 500 });
    testId = data as string | null;
  }
  if (!testId) return NextResponse.json({ error: "Enter the test name." }, { status: 400 });

  const { data: test } = await v.admin.from("investigation_catalogue").select("id, test_name").eq("id", testId).eq("scope", "platform").maybeSingle();
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  await v.admin.from("investigation_test_requests").insert({ platform_test_id: test.id, provider_id: v.provider.id, booking_id: v.booking.id });
  await v.admin.rpc("investigation_ask_labs", { p_test: test.id });
  return NextResponse.json({ ok: true, test_name: test.test_name });
}
