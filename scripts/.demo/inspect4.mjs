import { db, must } from "./db.mjs";
const users = must(await db.from("users").select("id").like("email","%@streetdocmd.test"));
const ps = must(await db.from("providers").select("id,name,referral_code,profession,specialty,verification_status,available,lat,lng,photo_url").in("user_id",users.map(u=>u.id)));
for (const p of ps) { const s = must(await db.from("provider_services").select("service_type,price").eq("provider_id",p.id).eq("active",true)); console.log(p.name,"|",p.profession,"|",p.verification_status,"|",p.referral_code,"|photo:",!!p.photo_url,"|",s.map(x=>x.service_type+":"+x.price).join(",")); }
