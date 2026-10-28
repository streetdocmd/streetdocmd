import { createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
import EditProfileForm from "./EditProfileForm";

export default async function EditProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("*").eq("id", user!.id).single();

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar title="Edit profile" backHref="/dashboard/profile" className="-mx-5 -mt-2 md:mx-0" />
      <EditProfileForm userId={user!.id} profile={profile} />
    </div>
  );
}