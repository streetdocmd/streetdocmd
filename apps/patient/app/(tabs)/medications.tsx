import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Linking, Alert, ActivityIndicator
} from "react-native";
import { supabase } from "../../lib/supabase";
import { formatNaira } from "@streetdocmd/shared";

const STATUS_STEPS = [
  "pending_payment", "sent", "confirmed", "dispensing", "dispatched", "delivered",
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  sent:            "Order Received by Pharmacy",
  confirmed:       "Order Confirmed",
  dispensing:      "Being Dispensed",
  dispatched:      "Out for Delivery",
  delivered:       "Delivered",
  cancelled:       "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "#F59E0B",
  sent:            "#3B82F6",
  confirmed:       "#8B5CF6",
  dispensing:      "#F97316",
  dispatched:      "#059669",
  delivered:       "#059669",
  cancelled:       "#EF4444",
};

interface MedOrder {
  id: string;
  status: string;
  total_amount: number;
  payment_status: string;
  prescription_pdf_url: string | null;
  requires_review: boolean;
  created_at: string;
  drugs: { drug_name: string; strength?: string; quantity?: number; price?: number }[];
  pharmacy_partners: { name: string; phone: string } | null;
  delivery_tracking: {
    id: string;
    rider_name: string | null;
    rider_phone: string | null;
    estimated_arrival: string | null;
    delivered_at: string | null;
    proof_of_delivery_url: string | null;
  }[];
}

const PATIENT_WEB_URL = "https://streetdocmd-patient-web.vercel.app";

export default function MedicationsScreen() {
  const [orders, setOrders] = useState<MedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    load();
    let channel: ReturnType<typeof supabase.channel>;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel(`meds-${user.id}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "prescription_orders",
          filter: `patient_id=eq.${user.id}`,
        }, () => load())
        .on("postgres_changes", {
          event: "*", schema: "public", table: "delivery_tracking",
        }, () => load())
        .subscribe();
    });
    return () => { channel?.unsubscribe(); };
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("prescription_orders")
      .select(`
        id, status, total_amount, payment_status, prescription_pdf_url,
        requires_review, created_at, drugs,
        pharmacy_partners(name, phone),
        delivery_tracking(id, rider_name, rider_phone, estimated_arrival, delivered_at, proof_of_delivery_url)
      `)
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });

    setOrders((data as unknown as MedOrder[]) ?? []);
    setLoading(false);
  }

  async function initiatePayment(order: MedOrder) {
    setPaying(order.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPaying(null); return; }

    const res = await fetch(`${PATIENT_WEB_URL}/api/pharmacy/payment/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, userId: user.id }),
    });

    const { authorization_url, error } = await res.json();
    setPaying(null);

    if (error) {
      Alert.alert("Payment Error", error);
      return;
    }

    await Linking.openURL(authorization_url);
  }

  async function confirmDelivery(orderId: string) {
    setConfirming(orderId);
    await supabase
      .from("prescription_orders")
      .update({ status: "delivered" })
      .eq("id", orderId);
    setConfirming(null);
    load();
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={o => o.id}
      contentContainerStyle={orders.length === 0 ? s.center : s.list}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No medication orders</Text>
          <Text style={s.emptyText}>Prescription orders from your doctor will appear here.</Text>
        </View>
      }
      renderItem={({ item: order }) => {
        const isExpanded = expanded === order.id;
        const tracking = order.delivery_tracking?.[0];
        const statusColor = STATUS_COLOR[order.status] ?? "#6B7280";
        const stepIdx = STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]);

        return (
          <View style={s.card}>
            <TouchableOpacity
              style={s.cardHeader}
              onPress={() => setExpanded(isExpanded ? null : order.id)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={s.headerRow}>
                  <Text style={s.pharmacyName}>{(order.pharmacy_partners as any)?.name ?? "Pharmacy"}</Text>
                  {order.requires_review && (
                    <View style={s.reviewBadge}><Text style={s.reviewBadgeText}>⚠ Review</Text></View>
                  )}
                </View>
                <Text style={s.drugList}>{order.drugs?.map(d => d.drug_name).join(", ")}</Text>
                <View style={[s.statusPill, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABELS[order.status] ?? order.status}</Text>
                </View>
              </View>
              <Text style={s.chevron}>{isExpanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={s.details}>
                {/* Progress bar */}
                {order.status !== "cancelled" && (
                  <View style={s.progressRow}>
                    {STATUS_STEPS.map((step, i) => (
                      <View key={step} style={s.stepWrap}>
                        <View style={[s.dot, i <= stepIdx && { backgroundColor: "#1E6FD9" }]} />
                        {i < STATUS_STEPS.length - 1 && (
                          <View style={[s.line, i < stepIdx && { backgroundColor: "#1E6FD9" }]} />
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Drug list */}
                <Text style={s.sectionLabel}>Medications</Text>
                {order.drugs?.map((d, i) => (
                  <View key={i} style={s.drugRow}>
                    <Text style={s.drugName}>{d.drug_name}{d.strength ? ` ${d.strength}` : ""}</Text>
                    {d.price != null && d.price > 0 && (
                      <Text style={s.drugPrice}>{formatNaira(d.price)}</Text>
                    )}
                  </View>
                ))}

                {/* Total + payment */}
                {order.total_amount > 0 && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total</Text>
                    <Text style={s.totalAmount}>{formatNaira(order.total_amount)}</Text>
                  </View>
                )}

                {/* Pay button */}
                {order.status === "pending_payment" && order.payment_status === "pending" && order.total_amount > 0 && (
                  <TouchableOpacity
                    style={[s.payBtn, paying === order.id && { opacity: 0.5 }]}
                    onPress={() => initiatePayment(order)}
                    disabled={paying === order.id}
                  >
                    <Text style={s.payBtnText}>
                      {paying === order.id ? "Opening Paystack…" : `Pay ${formatNaira(order.total_amount)}`}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Rider info when dispatched */}
                {order.status === "dispatched" && tracking && (
                  <View style={s.riderCard}>
                    <Text style={s.riderTitle}>🛵 Rider En Route</Text>
                    {tracking.rider_name && <Text style={s.riderName}>{tracking.rider_name}</Text>}
                    {tracking.rider_phone && (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${tracking.rider_phone}`)}>
                        <Text style={s.riderPhone}>{tracking.rider_phone} — tap to call</Text>
                      </TouchableOpacity>
                    )}
                    {tracking.estimated_arrival && (
                      <Text style={s.eta}>
                        ETA: {new Date(tracking.estimated_arrival).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                  </View>
                )}

                {/* Confirm delivery */}
                {order.status === "dispatched" && (
                  <TouchableOpacity
                    style={[s.confirmBtn, confirming === order.id && { opacity: 0.5 }]}
                    onPress={() => Alert.alert("Confirm Delivery", "Have you received your medications?", [
                      { text: "Not Yet", style: "cancel" },
                      { text: "Yes, Received", onPress: () => confirmDelivery(order.id) },
                    ])}
                    disabled={confirming === order.id}
                  >
                    <Text style={s.confirmBtnText}>
                      {confirming === order.id ? "Confirming…" : "✓ I've Received My Medications"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Proof of delivery */}
                {order.status === "delivered" && tracking?.proof_of_delivery_url && (
                  <TouchableOpacity
                    style={s.pdfBtn}
                    onPress={() => Linking.openURL(tracking.proof_of_delivery_url!)}
                  >
                    <Text style={s.pdfBtnText}>📷 View Delivery Confirmation</Text>
                  </TouchableOpacity>
                )}

                {/* Prescription PDF */}
                {order.prescription_pdf_url && (
                  <TouchableOpacity
                    style={s.pdfBtn}
                    onPress={() => Linking.openURL(order.prescription_pdf_url!)}
                  >
                    <Text style={s.pdfBtnText}>📄 View Prescription PDF</Text>
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

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  cardHeader: { padding: 16, flexDirection: "row", alignItems: "flex-start" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  pharmacyName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  reviewBadge: { backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  reviewBadgeText: { fontSize: 10, fontWeight: "700", color: "#D97706" },
  drugList: { fontSize: 13, color: "#6B7280", marginBottom: 6 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "700" },
  chevron: { color: "#9CA3AF", fontSize: 12, marginLeft: 8, marginTop: 2 },
  details: { borderTopWidth: 1, borderTopColor: "#F3F4F6", padding: 16, gap: 10 },
  // Progress
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  stepWrap: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5E7EB" },
  line: { width: 18, height: 2, backgroundColor: "#E5E7EB" },
  // Drugs
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 },
  drugRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  drugName: { fontSize: 13, color: "#374151", flex: 1 },
  drugPrice: { fontSize: 13, fontWeight: "600", color: "#111827" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  totalAmount: { fontSize: 15, fontWeight: "800", color: "#111827" },
  // Buttons
  payBtn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  payBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  confirmBtn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pdfBtn: { backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  pdfBtnText: { color: "#1E6FD9", fontWeight: "600", fontSize: 13 },
  // Rider
  riderCard: { backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  riderTitle: { fontSize: 13, fontWeight: "700", color: "#059669", marginBottom: 6 },
  riderName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  riderPhone: { fontSize: 13, color: "#1E6FD9", marginTop: 2 },
  eta: { fontSize: 12, color: "#6B7280", marginTop: 4 },
});
