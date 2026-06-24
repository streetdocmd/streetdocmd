import { createServerSupabase } from "@/lib/supabase-server";
import EditProfileForm from "./EditProfileForm";

export default async function EditProfilePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("*").eq("id", user!.id).single();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Medical Profile</h1>
      <EditProfileForm userId={user!.id} profile={profile} />
    </div>
  );
}