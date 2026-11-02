// Hides seeded test accounts (@streetdocmd.test) from patients, or shows them
// for a test run. Hidden accounts can still sign in.
//
//   node scripts/test-accounts.mjs list
//   node scripts/test-accounts.mjs hide
//   node scripts/test-accounts.mjs show physio1 lab1
//   node scripts/test-accounts.mjs show --all
//
// A shown account is visible to real patients, so hide it again after the test.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DOMAIN = "@streetdocmd.test";
const PARTNER_TABLES = ["lab_partners", "pharmacy_partners", "hospital_partners"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, "apps/admin/.env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function must({ data, error }, step) {
  if (error) throw new Error(`${step}: ${error.message}`);
  return data;
}

async function load() {
  const users = must(await admin.from("users").select("id, email").like("email", `%${DOMAIN}`), "users");
  const ids = users.map((u) => u.id);
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const providers = must(await admin.from("providers").select("id, user_id, name, verification_status").in("user_id", ids), "providers")
    .map((p) => ({ table: "providers", id: p.id, name: p.name, email: emailOf.get(p.user_id), hidden: p.verification_status !== "verified" }));
  const partners = [];
  for (const table of PARTNER_TABLES) {
    const rows = must(await admin.from(table).select("id, name, email, active").like("email", `%${DOMAIN}`), table);
    partners.push(...rows.map((p) => ({ table, id: p.id, name: p.name, email: p.email, hidden: !p.active })));
  }
  return [...providers, ...partners];
}

async function setHidden(account, hidden) {
  const change = account.table === "providers"
    ? { verification_status: hidden ? "test" : "verified", ...(hidden ? { available: false } : {}) }
    : { active: !hidden };
  must(await admin.from(account.table).update(change).eq("id", account.id), account.email);
}

const [command, ...args] = process.argv.slice(2);
const accounts = await load();

if (command === "hide") {
  for (const a of accounts) await setHidden(a, true);
} else if (command === "show") {
  const all = args.includes("--all");
  const chosen = all ? accounts : accounts.filter((a) => args.includes(a.email.replace(DOMAIN, "")));
  if (chosen.length === 0) throw new Error("Name the accounts to show, e.g. show physio1 lab1, or use --all.");
  for (const a of chosen) await setHidden(a, false);
  console.log("These accounts are visible to real patients until you run: node scripts/test-accounts.mjs hide");
} else if (command !== "list") {
  throw new Error("Usage: node scripts/test-accounts.mjs list | hide | show <names...> | show --all");
}

for (const a of await load()) console.log(`${a.hidden ? "hidden " : "VISIBLE"}  ${a.email}  ${a.name}`);
