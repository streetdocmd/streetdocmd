// Sends the launch email to each survey respondent who asked to hear about the
// launch, one email per person (nobody sees anyone else's address), through
// Resend's free plan (100 emails a day).
//
// The seven respondents who answered "No" to being notified are not in
// recipients.txt. Keep this folder out of git: the list is personal data.
//
//   Preview only (sends nothing):   node send.mjs
//   Send one test to yourself:      node send.mjs --test you@example.com
//   Send to everyone:               node send.mjs --send
//
// Needs RESEND_API_KEY in the environment (the same key the app's
// send-notification function uses). Addresses already sent are recorded in
// sent.log, so running --send again after a failure only sends the rest.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const FROM = process.env.LAUNCH_FROM ?? "StreetdocMD <contact@streetdocmd.com>";
const REPLY_TO = "contact@streetdocmd.com";
const SUBJECT = "StreetdocMD is live: care at your doorstep in Ibadan";
const BOOK_URL = "https://app.streetdocmd.com";
const LOG = join(DIR, "sent.log");

const text = `Hello,

A few weeks ago you took our short survey about home healthcare in Ibadan and asked us to let you know when we launch. Thank you. Your answers directly shaped what we built.

StreetdocMD is now live. You can book a verified doctor, nurse or physiotherapist to come to you, or to your parents, at home, and arrange lab sample collection at home too. Every professional on the platform has had their licence checked, and you can book a follow-up with the same person you saw before.

Book your first visit: ${BOOK_URL}

If you'd like help booking or have any questions, email contact@streetdocmd.com or WhatsApp us on 07063216791.

Know a parent, relative or friend who could use this? Please share the link with them.

Thank you for being one of the first to back us.

The StreetdocMD Team
Healthcare, Closer to you

You're receiving this because you shared your email address in our StreetdocMD survey and asked to hear about our launch. If you'd rather not hear from us again, reply "unsubscribe" and we'll remove you.`;

const p = s => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#121D2D">${s}</p>`;
const html = `<!doctype html><html><body style="margin:0;background:#F3F7FC;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F7FC;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #DCE4EF;border-radius:20px">
<tr><td style="padding:28px 28px 8px"><img src="https://app.streetdocmd.com/logo.png" alt="StreetdocMD" height="34" style="display:block;height:34px"></td></tr>
<tr><td style="padding:14px 28px 8px">
${p("Hello,")}
${p("A few weeks ago you took our short survey about home healthcare in Ibadan and asked us to let you know when we launch. Thank you. Your answers directly shaped what we built.")}
${p("StreetdocMD is now live. You can book a verified doctor, nurse or physiotherapist to come to you, or to your parents, at home, and arrange lab sample collection at home too. Every professional on the platform has had their licence checked, and you can book a follow-up with the same person you saw before.")}
<p style="margin:8px 0 22px"><a href="${BOOK_URL}" style="display:inline-block;background:#0066CD;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:999px">Book your first visit</a></p>
${p(`If you'd like help booking or have any questions, email <a href="mailto:contact@streetdocmd.com" style="color:#0066CD">contact@streetdocmd.com</a> or WhatsApp us on 07063216791.`)}
${p("Know a parent, relative or friend who could use this? Please share the link with them.")}
${p("Thank you for being one of the first to back us.")}
<p style="margin:0 0 4px;font-size:15px;color:#121D2D">The StreetdocMD Team</p>
<p style="margin:0 0 22px;font-size:14px;color:#566577">Healthcare, Closer to you</p>
</td></tr></table>
<p style="max-width:540px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#5B6878">You're receiving this because you shared your email address in our StreetdocMD survey and asked to hear about our launch. If you'd rather not hear from us again, reply "unsubscribe" and we'll remove you.</p>
</td></tr></table></body></html>`;

async function send(to) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: SUBJECT,
      text,
      html,
      // Lets Gmail and others show their own "Unsubscribe" button
      headers: { "List-Unsubscribe": `<mailto:${REPLY_TO}?subject=unsubscribe>` },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const recipients = [...new Set(readFileSync(join(DIR, "recipients.txt"), "utf8").split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean))];
const sent = new Set(existsSync(LOG) ? readFileSync(LOG, "utf8").split(/\r?\n/).map(l => l.split("\t")[1]).filter(Boolean) : []);
const pending = recipients.filter(r => !sent.has(r));

if (!args.length) {
  console.log(`Preview only. ${recipients.length} recipients, ${sent.size} already sent, ${pending.length} to go.\n`);
  console.log(`From: ${FROM}\nSubject: ${SUBJECT}\n\n${text}\n`);
  console.log("Run with --test you@example.com to send yourself one, or --send to send to everyone.");
  process.exit(0);
}
if (!process.env.RESEND_API_KEY) {
  console.error("Set RESEND_API_KEY first (the same key the app's send-notification function uses).");
  process.exit(1);
}
if (args[0] === "--test") {
  if (!args[1]) { console.error("Add the address to send the test to."); process.exit(1); }
  await send(args[1]);
  console.log(`Test sent to ${args[1]}. Check it looks right, then run with --send.`);
  process.exit(0);
}
if (args[0] !== "--send") { console.error("Use --test you@example.com or --send."); process.exit(1); }

console.log(`Sending to ${pending.length} people, one at a time...`);
let ok = 0, failed = 0;
for (const to of pending) {
  try {
    await send(to);
    appendFileSync(LOG, `${new Date().toISOString()}\t${to}\n`);
    ok++;
    console.log(`  sent  ${to}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${to}  ${e.message}`);
  }
  await sleep(700); // Resend allows 2 a second on the free plan
}
console.log(`\nDone: ${ok} sent, ${failed} failed.${failed ? " Run --send again to retry the failed ones." : ""}`);
