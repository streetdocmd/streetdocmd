import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import MedicalOnboardingForm from "./MedicalOnboardingForm";

export const dynamic = "force-dynamic";

export default async function MedicalOnboardingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("dob, gender, blood_group, known_conditions, current_medications, allergies, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row means sign-up never finished (e.g. it was interrupted
  // after the login was created) — send them to complete it first.
  if (!profile) redirect("/register?complete=1");

  return <MedicalOnboardingForm initial={profile} />;
}
