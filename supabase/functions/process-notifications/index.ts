import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TERMII_API_KEY = Deno.env.get("TERMII_API_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "hello@streetdocmd.com";
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

async function sendEmail(to: string, subject: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html: `<p>${message}</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (_req) => {
  const now = new Date().toISOString();

  // Fetch due notifications that haven't been sent yet — either a patient
  // SMS (the original path) or a provider email (preferred-provider
  // requests, migration 037).
  const { data: queue, error } = await supabase
    .from("notifications_queue")
    .select(`
      id, message, subject, type, channel, patient_id, provider_id,
      users!patient_id(phone),
      providers!provider_id(users!user_id(email))
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
      if (row.channel === "email") {
        const email = ((row.providers as any)?.users as any)?.email;
        if (!RESEND_API_KEY || !email) {
          // Not configured / no email on file — mark sent so it doesn't retry forever
          await supabase.from("notifications_queue").update({
            sent: true, sent_at: now,
            error: !RESEND_API_KEY ? "resend_not_configured" : "no_email",
          }).eq("id", row.id);
          return { id: row.id, sent: false, reason: "email_unavailable" };
        }

        const ok = await sendEmail(email, row.subject ?? "StreetdocMD notification", row.message);
        await supabase.from("notifications_queue").update({
          sent: ok,
          sent_at: ok ? now : null,
          error: ok ? null : "email_failed",
        }).eq("id", row.id);
        return { id: row.id, sent: ok };
      }

      // Default path: patient SMS (unchanged from before channel existed)
      const phone = (row.users as any)?.phone;
      if (!TERMII_API_KEY || !phone) {
        await supabase.from("notifications_queue").update({
          sent: true, sent_at: now,
          error: !TERMII_API_KEY ? "termii_not_configured" : "no_phone",
        }).eq("id", row.id);
        return { id: row.id, sent: false, reason: "sms_unavailable" };
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
