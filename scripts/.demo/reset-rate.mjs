import { db, must } from "./db.mjs";
console.log(must(await db.from("provider_services").delete().eq("provider_id","a3d46ac8-52fe-4dfe-9fb6-19a5a578aa6f").eq("service_type","custom_request").select("service_type,price")));
