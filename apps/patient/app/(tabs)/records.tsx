import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { SERVICE_LABELS } from "@streetdocmd/shared";

export default function RecordsScreen() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadVisits();
  }, []);

  async function loadVisits() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookings")
      .select("id, service_type, completed_at, providers!bookings_provider_id_fkey(name), visits(id, diagnosis, treatment, follow_up_plan, prescription_url)")
      .eq("patient_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    setVisits(data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  return (
    <FlatList
      data={visits}
      keyExtractor={(v) => v.id}
      contentContainerStyle={visits.length === 0 ? styles.center : styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyText}>Your visit records will appear here after completed visits.</Text>
        </View>
      }
      renderItem={({ item: b }) => {
        const visit = b.visits?.[0];
        const isExpanded = expanded === b.id;
        return (
          <View style={styles.card}>
            <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : b.id)} style={styles.cardHeader}>
              <View>
                <Text style={styles.service}>{SERVICE_LABELS[b.service_type]}</Text>
                <Text style={styles.meta}>
                  {b.providers?.name} · {new Date(b.completed_at).toLocaleDateString("en-NG")}
                </Text>
              </View>
              <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {isExpanded && visit && (
              <View style={styles.details}>
                {visit.diagnosis && <Detail label="Diagnosis" value={visit.diagnosis} />}
                {visit.treatment && <Detail label="Treatment" value={visit.treatment} />}
                {visit.follow_up_plan && <Detail label="Follow-up" value={visit.follow_up_plan} />}
                {visit.prescription_url && (
                  <TouchableOpacity
                    style={styles.pdfBtn}
                    onPress={() => Linking.openURL(visit.prescription_url)}
                  >
                    <Text style={styles.pdfBtnText}>📄 View Prescription (PDF)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: "#374151", marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 16
  },
  service: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  chevron: { color: "#9CA3AF", fontSize: 12 },
  details: { borderTopWidth: 1, borderTopColor: "#F3F4F6", padding: 16 },
  pdfBtn: {
    marginTop: 8, backgroundColor: "#EFF6FF", borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14
  },
  pdfBtnText: { color: "#1E6FD9", fontWeight: "600", fontSize: 13 },
});
