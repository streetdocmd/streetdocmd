import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatNaira, SERVICE_LABELS } from "@streetdocmd/shared";

export default function PaymentScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    supabase
      .from("bookings")
      .select("*, providers(name, specialty)")
      .eq("id", bookingId)
      .single()
      .then(({ data }) => {
        setBooking(data);
        setLoading(false);
      });
  }, [bookingId]);

  async function initiatePayment() {
    setPaying(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const res = await fetch("https://streetdocmd.vercel.app/api/payments/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, userId: user.id }),
    });

    const { authorization_url, error } = await res.json();
    setPaying(false);

    if (error) {
      Alert.alert("Payment Error", error);
      return;
    }

    // Open Paystack checkout in browser
    await Linking.openURL(authorization_url);
    // On return, verify payment status
    router.push({ pathname: "/booking/tracking", params: { bookingId } });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E6FD9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Booking Summary</Text>
        <Row label="Service" value={(SERVICE_LABELS as Record<string, string>)[booking.service_type] ?? booking.service_type} />
        <Row label="Provider" value={booking.providers?.name} />
        <Row label="Consultation fee" value={formatNaira(booking.fee)} />
        <View style={styles.divider} />
        <Row label="Total" value={formatNaira(booking.fee)} bold />
      </View>

      <View style={styles.methodCard}>
        <Text style={styles.sectionTitle}>Payment via Paystack</Text>
        <Text style={styles.methodNote}>
          Pay securely with card, bank transfer, or USSD. Your payment details are never stored on StreetdocMD.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.payBtn, paying && styles.payBtnDisabled]}
        onPress={initiatePayment}
        disabled={paying}
      >
        <Text style={styles.payBtnText}>
          {paying ? "Opening Paystack…" : `Pay ${formatNaira(booking.fee)}`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel booking</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  methodCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rowLabel: { fontSize: 14, color: "#6B7280" },
  rowValue: { fontSize: 14, color: "#374151" },
  rowValueBold: { fontWeight: "700", color: "#111827", fontSize: 16 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },
  methodNote: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
  payBtn: { backgroundColor: "#1E6FD9", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancel: { marginTop: 16, alignItems: "center" },
  cancelText: { color: "#EF4444", fontSize: 14 },
});
