import { db, must } from "./db.mjs";
const k = must(await db.from("providers").select("id,user_id,name,referral_code,profession,specialty,lat,lng,available,verification_status,rating,total_visits,photo_url,years_experience").eq("name","Kunle Adeyemi")).at(0);
console.log(k);
console.log(must(await db.from("provider_services").select("service_type,price,active").eq("provider_id",k.id)));
for (const t of ["lab_partners","pharmacy_partners","hospital_partners"]) console.log(t, must(await db.from(t).select("id,name,address,lat,lng,active").like("email","%@streetdocmd.test")));
