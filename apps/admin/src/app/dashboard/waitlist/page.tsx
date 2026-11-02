export const dynamic = "force-dynamic";
import { createAdminSupabase } from "@/lib/supabase-server";

const ROLE_LABELS: Record<string, string> = {
  patient: "Patient or family",
  doctor: "Doctor",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  laboratory: "Laboratory",
  pharmacy: "Pharmacy",
  hospital: "Hospital",
};

// Sign-ups from the Contact page on the landing site (migration 077)
export default async function WaitlistPage() {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("waitlist_signups")
    .select("id, full_name, email, phone, city, role, message, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
        <p className="text-sm text-gray-500">
          {rows.length} {rows.length === 1 ? "person" : "people"} from the Contact page on the website
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">Could not load the waitlist: {error.message}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.full_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{ROLE_LABELS[r.role] ?? r.role}</td>
                <td className="px-4 py-3"><a href={`mailto:${r.email}`} className="text-teal-brand hover:underline">{r.email}</a></td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700">{r.city ?? "—"}</td>
                <td className="max-w-xs px-4 py-3 text-gray-600">{r.message ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nobody has joined yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
