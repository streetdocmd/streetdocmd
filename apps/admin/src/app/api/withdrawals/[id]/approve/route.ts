import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = createServerSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const supabase = createAdminSupabase();
  await supabase
    .from("withdrawals")
    .update({
      status: "approved",
      processed_by: user.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", "pending");

  return NextResponse.redirect(new URL("/dashboard/finance", req.url));
}