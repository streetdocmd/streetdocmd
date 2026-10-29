import { NextRequest, NextResponse } from "next/server";

// Paystack's redirect lands here. Read only: the webhook alone marks the order
// paid, so this just sends the patient back to the order, which shows the
// state the webhook has saved (possibly moments after this redirect).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.redirect(new URL(`/dashboard/investigations/${params.id}?paid=1`, req.url));
}
