import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Linking, ActivityIndicator
} from "react-native";
import { supabase } from "../../lib/supabase";

const STATUS_STEPS = [
  "ordered",
  "confirmed",
  "sample_collector_dispatched",
  "sample_collected",
  "processing",
  "resulted",
] as const;

const STATUS_LABELS: Record<string, string> = {
  ordered:                    "Order Placed",
  confirmed:                  "Confirmed by Lab",
  sample_collector_dispatched:"Sample Collector En Route",
  sample_collected:           "Sample Collected",
  processing:                 "Processing",
  resulted:                   "Results Ready",
};

const FLAG_COLORS: Record<string, string> = {
  normal:   "#059669",
  high:     "#DC2626",
  low:      "#2563EB",
  critical: "#7C3AED",
};

interface Result {
  id: string;
  test_name: string;
  result_value: string;
  unit: string;
  reference_range: string;
  flag: string;
  result_pdf_url: string;
}

interface Order {
  id: string;
  status: string;
  ordered_at: string;
  resulted_at: string | null;
  tests: { test_name: string; price: number }[];
  lab_partners: { name: string };
  investigation_results: Result[];
}

export default function InvestigationsScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Subscribe to status updates in real time
    let channel: ReturnType<typeof supabase.channel>;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel(`investigations-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "investigation_orders", filter: `patient_id=eq.${user.id}` },
          () => load()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "investigation_results" },
          () => load()
        )
        .subscribe();
    });
    return () => { channel?.unsubscribe(); };
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("investigation_orders")
      .select(`
        id, status, ordered_at, resulted_at, tests,
        lab_partners(name),
        investigation_results(id, test_name, result_value, unit, reference_range, flag, result_pdf_url)
      `)
      .eq("patient_id", user.id)
      .order("ordered_at", { ascending: false });

    setOrders((data as unknown as Order[]) ?? []);
    setLoading(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={orders.length === 0 ? s.center : s.list}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No investigations yet</Text>
          <Text style={s.emptyText}>Your provider will order lab tests during a consultation.</Text>
        </View>
      }
      renderItem={({ item: order }) => {
        const isExpanded = expanded === order.id;
        const stepIndex = STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]);
        const hasResults = order.investigation_results?.length > 0;
        const pdfUrl = order.investigation_results?.find((r) => r.result_pdf_url)?.result_pdf_url;

        return (
          <View style={s.card}>
            <TouchableOpacity
              style={s.cardHeader}
              onPress={() => setExpanded(isExpanded ? null : order.id)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={s.headerRow}>
                  <Text style={s.labName}>{order.lab_partners?.name ?? "Lab"}</Text>
                  <StatusBadge status={order.status} />
                </View>
                <Text style={s.testList}>
                  {order.tests?.map((t) => t.test_name).join(", ")}
                </Text>
                <Text style={s.date}>
                  Ordered {new Date(order.ordered_at).toLocaleDateString("en-NG", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </Text>
              </View>
              <Text style={s.chevron}>{isExpanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={s.details}>
                {/* Progress tracker */}
                <View style={s.progressRow}>
                  {STATUS_STEPS.map((step, i) => (
                    <View key={step} style={s.stepWrap}>
                      <View style={[s.stepDot, i <= stepIndex && s.stepDotActive]} />
                      {i < STATUS_STEPS.length - 1 && (
                        <View style={[s.stepLine, i < stepIndex && s.stepLineActive]} />
                      )}
                    </View>
                  ))}
                </View>
                <Text style={s.statusLabel}>{STATUS_LABELS[order.status]}</Text>

                {/* Results */}
                {hasResults && (
                  <View style={s.resultsSection}>
                    <Text style={s.resultsTitle}>Results</Text>
                    {order.investigation_results.map((r) => (
                      <View key={r.id} style={s.resultRow}>
                        <View style={s.resultLeft}>
                          <Text style={s.resultTestName}>{r.test_name}</Text>
                          {r.reference_range && (
                            <Text style={s.refRange}>Ref: {r.reference_range}</Text>
                          )}
                        </View>
                        <View style={s.resultRight}>
                          <Text style={[s.resultValue, r.flag && { color: FLAG_COLORS[r.flag] ?? "#111827" }]}>
                            {r.result_value}{r.unit ? ` ${r.unit}` : ""}
                          </Text>
                          {r.flag && r.flag !== "normal" && (
                            <Text style={[s.flagBadge, { color: FLAG_COLORS[r.flag] ?? "#111827" }]}>
                              {r.flag.toUpperCase()}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}

                    {pdfUrl && (
                      <TouchableOpacity
                        style={s.pdfBtn}
                        onPress={() => Linking.openURL(pdfUrl)}
                      >
                        <Text style={s.pdfBtnText}>📄 Download Full Report (PDF)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const resulted = status === "resulted";
  return (
    <View style={[s.badge, resulted && s.badgeGreen]}>
      <Text style={[s.badgeText, resulted && s.badgeTextGreen]}>
        {STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  cardHeader: { padding: 16, flexDirection: "row", alignItems: "flex-start" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  labName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  testList: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  date: { fontSize: 12, color: "#9CA3AF" },
  chevron: { color: "#9CA3AF", fontSize: 12, marginLeft: 8, marginTop: 2 },
  details: { borderTopWidth: 1, borderTopColor: "#F3F4F6", padding: 16 },
  // Progress tracker
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  stepWrap: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5E7EB" },
  stepDotActive: { backgroundColor: "#1E6FD9" },
  stepLine: { width: 20, height: 2, backgroundColor: "#E5E7EB" },
  stepLineActive: { backgroundColor: "#1E6FD9" },
  statusLabel: { fontSize: 13, fontWeight: "600", color: "#1E6FD9", marginBottom: 12 },
  // Results
  resultsSection: { marginTop: 8 },
  resultsTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  resultLeft: { flex: 1 },
  resultTestName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  refRange: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  resultRight: { alignItems: "flex-end" },
  resultValue: { fontSize: 14, fontWeight: "700", color: "#111827" },
  flagBadge: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  pdfBtn: { marginTop: 12, backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  pdfBtnText: { color: "#1E6FD9", fontWeight: "600", fontSize: 13, textAlign: "center" },
  // Status badge
  badge: { backgroundColor: "#F3F4F6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen: { backgroundColor: "#F0FDF4" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  badgeTextGreen: { color: "#059669" },
});
