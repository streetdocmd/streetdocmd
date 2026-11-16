// Writes a Playwright storageState for <email>, signed in via an admin-generated
// one-time code (no email is sent, password unchanged).
import { readFileSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { db, must } from "./db.mjs";
const [email, out] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(new URL("../../apps/admin/.env.local", import.meta.url),"utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,"")]}));
const link = must(await db.auth.admin.generateLink({ type: "magiclink", email }), "generateLink");
const jar = new Map();
const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) },
});
const { error } = await sb.auth.verifyOtp({ email, token: link.properties.email_otp, type: "magiclink" });
if (error) throw error;
const cookies = [...jar].filter(([, v]) => v).map(([name, value]) => ({ name, value, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 86400, httpOnly: false, secure: false, sameSite: "Lax" }));
cookies.push({ name: "sdm_analytics", value: "denied", domain: "localhost", path: "/", expires: Math.floor(Date.now()/1000)+86400, httpOnly:false, secure:false, sameSite:"Lax" });
writeFileSync(out, JSON.stringify({ cookies, origins: [] }));
console.log("session written for", email, cookies.length, "cookies");
