import { db, must } from "./db.mjs";
console.log(must(await db.from("providers").select("name,specialty,specialist_field,bio,years_experience,languages").in("name",["Halima Bello","Tobenna Eze","Kunle Adeyemi","Ngozi Umeh"])));
