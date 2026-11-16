import { db, must } from "./db.mjs";
console.log(must(await db.from("providers").update({ verification_status: "under_review" }).eq("name","Halima Bello").eq("verification_status","test").select("name,verification_status,available")));
console.log(must(await db.from("providers").update({ verification_status: "test", available: false }).eq("name","Tobenna Eze").eq("verification_status","under_review").select("id,name,verification_status,available,referral_code")));
