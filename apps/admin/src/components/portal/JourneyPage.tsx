import { notFound } from "next/navigation";
import { requirePortalAccess } from "./access";
import { PageHeader } from "./ui";
import type { PortalType } from "./config";
import { PORTALS } from "./config";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import CareChat from "@/components/CareChat";

// The care team chat for a journey this facility is part of (migration 068):
// a pharmacy, lab or hospital joins once one of its orders reaches it.
export default async function JourneyPage({ type, id }: { type: PortalType; id: string }) {
  const access = await requirePortalAccess(type);
  // Same rule as the database: the facility must be handling an order in it
  const { data: allowed } = await (await createServerSupabase()).rpc("care_chat_access", { p_episode: id });
  if (!allowed) notFound();

  const { data: ep } = await createAdminSupabase()
    .from("care_episodes")
    .select("id, title, status, users!patient_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!ep) notFound();
  const first = ((ep.users as any)?.name ?? "Patient").split(" ")[0];

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: `${PORTALS[type].base}/dashboard`, label: type === "hospital" ? "Referrals" : "Orders" }}
        title={`Care team chat · ${first}`}
        description={`${ep.title}. Updates about this patient's care, and messages from the clinicians and facilities involved.`}
      />
      <CareChat episodeId={ep.id} userId={access.user.id} closed={ep.status === "closed" || ep.status === "resolved"} />
    </div>
  );
}
