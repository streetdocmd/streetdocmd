import { db, must } from "./db.mjs";
const p = must(await db.from("providers").select("id").eq("name","Adaeze Okafor")).at(0);
const b = must(await db.from("bookings").select("id,patient_id,status,service_type,created_at").eq("provider_id", p.id));
console.log(b);
const u = must(await db.from("users").select("email,role,name").eq("id", b[0].patient_id)); console.log(u.map(x=>({role:x.role, testDomain: (x.email||"").endsWith("@streetdocmd.test")})));
