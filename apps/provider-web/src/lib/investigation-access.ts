import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

/** The signed in doctor and one of their own visits, or why not */
export async function doctorVisit(bookingId: unknown) {
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;

  const admin = createAdminSupabase();
  const { data: provider } = await admin.from("providers").select("id, profession").eq("user_id", user.id).maybeSingle();
  if (!provider || provider.profession !== "doctor") return { error: "Only doctors can order investigations.", status: 403 } as const;

  const { data: booking } = await admin
    .from("bookings")
    .select("id, patient_id, provider_id, status, care_episode_id, patient_address, patient_lat, patient_lng")
    .eq("id", typeof bookingId === "string" ? bookingId : "")
    .maybeSingle();
  if (!booking || booking.provider_id !== provider.id) return { error: "Visit not found", status: 404 } as const;
  return { admin, provider, booking } as const;
}

/** How many labs that could serve the visit address offer each test, for home collection and for a sample the doctor took */
export async function coverage(admin: ReturnType<typeof createAdminSupabase>, ids: string[], lat: number | null, lng: number | null) {
  const args = { p_test_ids: ids, p_lat: lat, p_lng: lng };
  const [{ data: home }, { data: doctor }] = await Promise.all([
    admin.rpc("investigation_test_coverage", { ...args, p_collection: "home" }),
    admin.rpc("investigation_test_coverage", { ...args, p_collection: "doctor" }),
  ]);
  const count = (rows: unknown) => new Map(((rows ?? []) as any[]).map(r => [r.platform_test_id as string, Number(r.labs)]));
  return { home: count(home), doctor: count(doctor) };
}
