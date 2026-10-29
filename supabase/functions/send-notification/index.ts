// Delivers rows from public.notifications (migration 065) by email (Resend)
// and push (Expo for the mobile apps, Web Push for browsers).
//
// Called by the notifications_dispatch trigger with { id }, and by the
// notifications-sweep cron job with { sweep: true } to retry what's pending.
// It only ever sends rows already in the table and claims each one first
// (pending -> sending), so it needs no caller secret and never sends twice.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "contact@streetdocmd.com";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@streetdocmd.com";

const APP_URLS: Record<string, string> = {
  patient: Deno.env.get("PATIENT_APP_URL") ?? "https://app.streetdocmd.com",
  provider: Deno.env.get("PROVIDER_APP_URL") ?? "https://provider.streetdocmd.com",
  pharmacy: Deno.env.get("ADMIN_APP_URL") ?? "https://admin.streetdocmd.com",
  lab: Deno.env.get("ADMIN_APP_URL") ?? "https://admin.streetdocmd.com",
  hospital: Deno.env.get("ADMIN_APP_URL") ?? "https://admin.streetdocmd.com",
  admin: Deno.env.get("ADMIN_APP_URL") ?? "https://admin.streetdocmd.com",
};

const CATEGORY_LABEL: Record<string, string> = {
  visits: "visit updates",
  orders: "order updates",
  payments: "payments and payouts",
  account: "account updates",
  reviews: "reviews",
  admin: "admin alerts",
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface Row {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  app: string;
  channels: string[];
  data: Record<string, unknown>;
  attempts: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function emailHtml(n: Row, url: string, name: string | null) {
  const base = APP_URLS[n.app];
  const settings = `${base}${n.app === "patient" || n.app === "provider" || n.app === "admin" ? "/dashboard" : `/${n.app}-portal`}/notifications`;
  return `<!doctype html><html><body style="margin:0;background:#F3F7FC;font-family:Inter,Segoe UI,Arial,sans-serif;color:#121D2D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F7FC;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #DCE4EF;border-radius:20px">
<tr><td style="padding:26px 28px 6px"><img src="${APP_URLS.patient}/logo.png" alt="StreetdocMD" height="32" style="display:block;height:32px"></td></tr>
<tr><td style="padding:14px 28px 4px">
${name ? `<p style="margin:0 0 10px;font-size:14px;color:#5B6878">Hi ${esc(name.split(" ")[0])},</p>` : ""}
<h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:#0D2B5E">${esc(n.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#121D2D">${esc(n.body)}</p>
</td></tr>
<tr><td style="padding:22px 28px 26px"><a href="${url}" style="display:inline-block;background:#0D2B5E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:999px">Open StreetdocMD</a></td></tr>
</table>
<p style="max-width:520px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#5B6878">
You're getting this because ${esc(CATEGORY_LABEL[n.category] ?? "notifications")} are switched on for your StreetdocMD account.
<a href="${settings}" style="color:#5B6878">Change your notification settings</a>.
</p>
</td></tr></table></body></html>`;
}

async function sendEmail(to: string, n: Row, url: string, name: string | null): Promise<string> {
  if (!RESEND_API_KEY) return "not_configured";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `StreetdocMD <${RESEND_FROM_EMAIL}>`,
      to,
      subject: n.title,
      html: emailHtml(n, url, name),
      text: `${n.title}\n\n${n.body}\n\n${url}`,
    }),
  });
  return res.ok ? "sent" : `failed_${res.status}`;
}

async function sendPush(n: Row, url: string): Promise<string> {
  const { data: subs } = await supabase.from("push_subscriptions").select("id, kind, token, keys").eq("user_id", n.user_id);
  // Older app builds stored a single Expo token on users
  const { data: legacy } = await supabase.from("users").select("push_token").eq("id", n.user_id).maybeSingle();
  const list = [...(subs ?? [])];
  if (legacy?.push_token?.startsWith("ExponentPushToken") && !list.some(s => s.token === legacy.push_token)) {
    list.push({ id: null, kind: "expo", token: legacy.push_token, keys: null });
  }
  if (!list.length) return "no_devices";

  let sent = 0;
  const dead: string[] = [];

  const expo = list.filter(s => s.kind === "expo");
  if (expo.length) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(expo.map(s => ({
        to: s.token, title: n.title, body: n.body, sound: "default",
        data: { ...n.data, link: n.link, url, notification_id: n.id },
      }))),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    (json?.data ?? []).forEach((t: any, i: number) => {
      if (t?.status === "ok") sent++;
      else if (t?.details?.error === "DeviceNotRegistered" && expo[i].id) dead.push(expo[i].id);
    });
  }

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    for (const s of list.filter(s => s.kind === "web")) {
      try {
        await webpush.sendNotification(
          { endpoint: s.token, keys: s.keys },
          JSON.stringify({ title: n.title, body: n.body, url, id: n.id }),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e: any) {
        if ((e?.statusCode === 404 || e?.statusCode === 410) && s.id) dead.push(s.id);
      }
    }
  }

  if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);
  if (sent) {
    await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() })
      .eq("user_id", n.user_id);
  }
  return sent ? `sent_${sent}` : "failed";
}

async function deliver(id: string) {
  // Claim the row so two callers never send it twice
  const { data: claimed } = await supabase
    .from("notifications")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  const n = claimed as (Row & { attempts: number }) | null;
  if (!n) return { id, skipped: true };

  // Too old to be useful (e.g. queued while the function was down): keep it
  // in the inbox but don't email or push it
  if (Date.now() - new Date((n as any).created_at).getTime() > 6 * 3600_000) {
    await supabase.from("notifications").update({ status: "done", email_status: "expired", push_status: "expired" }).eq("id", id);
    return { id, expired: true };
  }

  try {
    const [{ data: user }, { data: pref }] = await Promise.all([
      supabase.from("users").select("email, name").eq("id", n.user_id).maybeSingle(),
      supabase.from("notification_preferences").select("prefs").eq("user_id", n.user_id).maybeSingle(),
    ]);
    const p = (pref?.prefs ?? {})[n.category] ?? {};
    const url = `${APP_URLS[n.app] ?? APP_URLS.patient}${n.link ?? ""}`;

    let email_status = "off";
    if (n.channels.includes("email") && p.email !== false) {
      email_status = user?.email ? await sendEmail(user.email, n, url, user.name ?? null) : "no_email";
    }
    let push_status = "off";
    if (n.channels.includes("push") && p.push !== false) push_status = await sendPush(n, url);

    await supabase.from("notifications")
      .update({ status: "done", email_status, push_status, attempts: n.attempts + 1 })
      .eq("id", id);
    return { id, email_status, push_status };
  } catch (e) {
    // Back to pending for the sweep, up to 5 attempts
    await supabase.from("notifications")
      .update({ status: n.attempts + 1 >= 5 ? "done" : "pending", attempts: n.attempts + 1, email_status: `error: ${String(e).slice(0, 120)}` })
      .eq("id", id);
    return { id, error: String(e) };
  }
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));

  if (typeof body.id === "string") {
    return Response.json(await deliver(body.id));
  }

  if (body.sweep) {
    // Rows stuck in "sending" for over 10 minutes are released for retry
    await supabase.from("notifications").update({ status: "pending" })
      .eq("status", "sending").lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
    const { data } = await supabase.from("notifications").select("id")
      .eq("status", "pending").lt("attempts", 5)
      .lt("created_at", new Date(Date.now() - 60_000).toISOString())
      .order("created_at").limit(50);
    const results = [];
    for (const r of data ?? []) results.push(await deliver(r.id));
    return Response.json({ processed: results.length });
  }

  return Response.json({ error: "Invalid request" }, { status: 400 });
});
