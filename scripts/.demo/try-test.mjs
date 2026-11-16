import { db } from "./db.mjs";
const r = await db.from("providers").update({ verification_status: "test", available: false }).eq("name","Halima Bello").eq("verification_status","under_review").select("name,verification_status");
console.log(r.error?.message ?? r.data);
