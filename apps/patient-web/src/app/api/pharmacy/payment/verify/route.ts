import { NextRequest, NextResponse } from "next/server";

// Read-only callback landing page for the Paystack redirect. The Paystack
// webhook (admin/api/payments/webhook) is the only thing authorized to mark
// a prescription order as paid — this route never writes, it just sends the
// patient back to the app where the order's already-persisted state (updated
// by the webhook, possibly moments before or after this redirect lands) is shown.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
