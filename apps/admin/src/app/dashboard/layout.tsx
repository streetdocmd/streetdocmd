import { redirect } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import { SidebarProvider } from "@/components/ui/SidebarContext";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminSupabase } from "@/lib/supabase-server";

// Every dashboard page reads live operational data — never serve a cached render.
export const dynamic = "force-dynamic";

async function getQueueCounts() {
  const admin = createAdminSupabase();
  const [providers, facilities] = await Promise.all([
    admin.from("providers").select("id", { count: "exact", head: true }).in("verification_status", ["pending", "under_review"]),
    admin.from("facility_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review"]),
  ]);
  return { providers: providers.count ?? 0, facilities: facilities.count ?? 0 };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, name } = await getAdminSession();
  if (!user) redirect("/login");
  // Signed in, but not staff (e.g. a lab/pharmacy partner or a patient account).
  if (!isAdmin) redirect("/login?error=not_admin");

  const counts = await getQueueCounts();

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar counts={counts} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header adminName={name} adminEmail={user.email ?? null} adminId={user.id} />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
