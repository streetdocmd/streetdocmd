import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";

export default function HistoryScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prov } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!prov) { setLoading(false); return; }

    const { data } = await supabase
      .from("bookings")
      .select("id, service_type, status, fee, net_payout, patient_address, completed_at, visits(diagnosis)")
      .eq("provider_id", prov.id)
      .in("status", ["completed", "cancelled"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(50);

    setBookings(data ?? []);
    setLoading(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.count}>{bookings.length} visits</Text>
      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No visits yet</Text>
        </View>
      ) : bookings.map((b) => (
        <View key={b.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.service}>{b.service_type.replace(/_/g, " ")}</Text>
            <View style={[styles.badge, b.status === "completed" ? styles.badgeGreen : styles.badgeGray]}>
              <Text style={[styles.badgeText, b.status === "completed" ? styles.badgeTextGreen : styles.badgeTextGray]}>
                {b.status}
              </Text>
            </View>
          </View>
          <Text style={styles.address} numberOfLines={1}>{b.patient_address}</Text>
          {b.visits?.diagnosis ? (
            <Text style={styles.diagnosis} numberOfLines={1}>Dx: {b.visits.diagnosis}</Text>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={styles.date}>
              {b.completed_at
                ? new Date(b.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                : "—"}
            </Text>
            {b.status === "completed" && b.net_payout ? (
              <Text style={styles.payout}>+N{b.net_payout.toLocaleString()}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 13, color: "#6B7280", fontWeight: "500", marginBottom: 4 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#9CA3AF", fontSize: 15 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB", gap: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  service: { fontSize: 14, fontWeight: "600", color: "#111827", textTransform: "capitalize", flex: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeGreen: { backgroundColor: "#D1FAE5" },
  badgeGray: { backgroundColor: "#F3F4F6" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextGreen: { color: "#065F46" },
  badgeTextGray: { color: "#6B7280" },
  address: { fontSize: 12, color: "#6B7280" },
  diagnosis: { fontSize: 12, color: "#374151", fontStyle: "italic" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  date: { fontSize: 12, color: "#9CA3AF" },
  payout: { fontSize: 13, fontWeight: "700", color: "#059669" },
});