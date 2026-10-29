import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import SettingsForm from "./SettingsForm";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("key, value, description, updated_at")
    .order("key");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform-wide configuration values — changing these takes effect immediately, no deploy required.
        </p>
      </div>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Appearance</h2>
        <p className="text-sm text-gray-500">Saved on this device. System follows your device&apos;s light or dark setting.</p>
        <ThemeToggle className="max-w-sm" />
      </section>

      <SettingsForm settings={settings ?? []} />
    </div>
  );
}
