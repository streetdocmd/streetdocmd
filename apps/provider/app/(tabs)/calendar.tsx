import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default function CalendarScreen() {
  const [groups, setGroups] = useState<{ dateKey: string; dateLabel: string; bookings: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: prov } = await supabase.from("providers").select("id").eq("user_id", user.id).single();
    if (!prov) { setLoading(false); return; }

    const { data } = await supabase
      .from("bookings")
      .select("id, service_type, status, patient_address, scheduled_at, accepted_at, duration_minutes")
      .eq("provider_id", prov.id)
      .in("status", ACTIVE_STATUSES)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("accepted_at", { ascending: true });

    const byDate = new Map<string, any[]>();
    for (const b of data ?? []) {
      const at = b.scheduled_at ?? b.accepted_at;
      if (!at) continue;
      const dateKey = new Date(at).toLocaleDateString("en-CA");
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(b);
    }

    const sorted = Array.from(byDate.keys()).sort().map(dateKey => ({
      dateKey,
      dateLabel: new Date(dateKey + "T00:00:00").toLocaleDateString("en-NG", {
        weekday: "long", day: "numeric", month: "long",
      }),
      bookings: byDate.get(dateKey)!,
    }));

    setGroups(sorted);
    setLoading(false);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#059669" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {groups.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🗓️</Text>
          <Text style={s.emptyTitle}>Nothing scheduled</Text>
          <Text style={s.emptyText}>Accepted and scheduled visits will appear here.</Text>
        </View>
      ) : groups.map(group => (
        <View key={group.dateKey} style={{ marginBottom: 20 }}>
          <Text style={s.dateHeader}>{group.dateLabel}</Text>
          {group.bookings.map((b: any) => {
            const at = b.scheduled_at ?? b.accepted_at;
            const timeLabel = new Date(at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
            const endLabel = new Date(new Date(at).getTime() + b.duration_minutes * 60000)
              .toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

            return (
              <View key={b.id} style={s.card}>
                <View style={s.timeCol}>
                  <Text style={s.timeText}>{timeLabel}</Text>
                  <Text style={s.timeEnd}>–{endLabel}</Text>
                </View>
                <View style={s.divider} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.service}>{b.service_type.replace(/_/g, " ")}</Text>
                    {!b.scheduled_at && (
                      <View style={s.asapBadge}><Text style={s.asapBadgeText}>ASAP</Text></View>
                    )}
                  </View>
                  <Text style={s.address} numberOfLines={1}>{b.patient_address}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 80 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center" },
  dateHeader: { fontSize: 12, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", gap: 12,
  },
  timeCol: { width: 60, alignItems: "center" },
  timeText: { fontSize: 13, fontWeight: "700", color: "#064E3B" },
  timeEnd: { fontSize: 11, color: "#9CA3AF" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: "#F3F4F6" },
  service: { fontSize: 14, fontWeight: "600", color: "#111827", textTransform: "capitalize" },
  address: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  asapBadge: { backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  asapBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
});
