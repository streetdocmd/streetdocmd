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

// Titles for the in-app inbox copy of each queued message (migration 065)
const INBOX_TITLE: Record<string, string> = {
  follow_up: "Follow up reminder",
  follow_up_care: "Follow up recommended",
  follow_up_reminder: "Follow up reminder",
  preferred_provider_declined: "Provider unavailable",
  preferred_provider_request: "New visit request",
};

// Adds the message to the recipient's inbox (notifications, inbox only:
// this function already sends it by SMS or email)
async function copyToInbox(row: any) {
  const providerUserId = (row.providers as any)?.user_id ?? null;
  const userId = row.patient_id ?? providerUserId;
  if (!userId) return;
  // A row that failed to send is retried; copy it to the inbox only once
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).contains("data", { queue_id: row.id });
  if (count) return;
  await supabase.from("notifications").insert({
    data: { queue_id: row.id },
    user_id: userId,
    category: "visits",
    title: INBOX_TITLE[row.type] ?? row.subject ?? "Update from StreetdocMD",
    body: row.message,
    link: row.patient_id ? "/dashboard/my-care" : "/dashboard",
    app: row.patient_id ? "patient" : "provider",
    channels: [],
  });
}

Deno.serve(async (_req) => {
  const now = new Date().toISOString();

  // Fetch due notifications that haven't been sent yet — a patient SMS
  // (the original path), a provider email (preferred-provider requests,
  // migration 037), or a patient email (follow-up reminders, migration 041).
  const { data: queue, error } = await supabase
    .from("notifications_queue")
    .select(`
      id, message, subject, type, channel, patient_id, provider_id,
      users!patient_id(phone, email),
      providers!provider_id(user_id, users!user_id(email))
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
      await copyToInbox(row).catch(() => {});
      if (row.channel === "email") {
        const email = ((row.providers as any)?.users as any)?.email ?? (row.users as any)?.email;
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
