import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TERMII_API_KEY = Deno.env.get("TERMII_API_KEY") ?? "";
const BATCH_SIZE = 50;

async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: "StreetdocMD",
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: TERMII_API_KEY,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (_req) => {
  if (!TERMII_API_KEY) {
    return new Response(JSON.stringify({ error: "TERMII_API_KEY not configured" }), { status: 500 });
  }

  const now = new Date().toISOString();

  // Fetch due notifications that haven't been sent yet
  const { data: queue, error } = await supabase
    .from("notifications_queue")
    .select(`
      id, message, type, patient_id,
      users!patient_id(phone)
    `)
    .eq("sent", false)
    .lte("send_at", now)
    .order("send_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows = queue ?? [];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
  }

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const phone = (row.users as any)?.phone;
      if (!phone) {
        // No phone — mark as sent (no-op) so it doesn't retry forever
        await supabase.from("notifications_queue").update({ sent: true, sent_at: now }).eq("id", row.id);
        return { id: row.id, sent: false, reason: "no_phone" };
      }

      const ok = await sendSMS(phone, row.message);
      await supabase.from("notifications_queue").update({
        sent: ok,
        sent_at: ok ? now : null,
        error: ok ? null : "sms_failed",
      }).eq("id", row.id);

      return { id: row.id, sent: ok };
    })
  );

  const sent  = results.filter(r => r.status === "fulfilled" && (r.value as any).sent).length;
  const failed = results.length - sent;

  return new Response(
    JSON.stringify({ ok: true, processed: rows.length, sent, failed }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
