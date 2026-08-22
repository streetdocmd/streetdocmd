import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import Sidebar from "@/components/ui/Sidebar";
import Header from "@/components/ui/Header";
import EmergencyAlert from "@/components/EmergencyAlert";
import { SidebarProvider } from "@/components/ui/SidebarContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <EmergencyAlert />
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
