import { createServerSupabase } from "@/lib/supabase-server";
import { TopBar } from "@/components/ds";
import FamilyMembersSection from "../FamilyMembersSection";

export default async function FamilyMembersPage() {
  const supabase = await createServerSupabase();
  const { data: members } = await supabase
    .from("family_members")
    .select("id, name, relationship, dob")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar title="Family members" backHref="/dashboard/profile" className="-mx-5 -mt-2 md:mx-0" />
      <p className="mb-3.5 text-ds-sm text-muted">
        Add someone once, then choose them when you book. You pick who the visit is for at checkout.
      </p>
      <FamilyMembersSection initialMembers={members ?? []} />
    </div>
  );
}
