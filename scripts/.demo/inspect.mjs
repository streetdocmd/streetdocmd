import { db, must } from "./db.mjs";
const users = must(await db.from("users").select("id,email,role").like("email","%@streetdocmd.test"));
const provs = must(await db.from("providers").select("*").in("user_id", users.map(u=>u.id)));
console.log("PROVIDER COLS:", Object.keys(provs[0]).join(", "));
for (const p of provs) { const { count } = await db.from("bookings").select("id",{count:"exact",head:true}).eq("provider_id", p.id); console.log(p.name, p.category||p.type||"", p.specialty||"", "bookings:", count); }
for (const t of ["bookings","users","visits","prescriptions","care_episodes","lab_partners","pharmacy_partners"]) { const r = await db.from(t).select("*").limit(1); console.log("\n"+t+":", r.error?.message || Object.keys(r.data[0]||{}).join(", ")); }
