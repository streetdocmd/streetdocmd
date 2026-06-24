import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { formatNaira } from "@streetdocmd/shared";

export default function EarningsScreen() {
  const [provider, setProvider] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => { loadEarnings(); }, []);

  async function loadEarnings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prov } = await supabase
      .from("providers")
      .select("id, name, wallet_balance, bank_name, bank_account_number, bank_account_name")
      .eq("user_id", user.id)
      .single();

    setProvider(prov);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: completed } = await supabase
      .from("bookings")
      .select("id, service_type, fee, commission, net_payout, completed_at")
      .eq("provider_id", prov.id)
      .eq("status", "completed")
      .gte("completed_at", startOfMonth)
      .order("completed_at", { ascending: false });

    setBookings(completed ?? []);
    setLoading(false);
  }

  async function requestWithdrawal() {
    if (!provider?.bank_account_number) {
      Alert.alert("Bank details required", "Please add your bank details in your profile first.");
      return;
    }
    if (provider.wallet_balance < 1000) {
      Alert.alert("Minimum withdrawal", "Minimum withdrawal amount is ₦1,000.");
      return;
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ${formatNaira(provider.wallet_balance)} to ${provider.bank_name} · ${provider.bank_account_number}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          onPress: async () => {
            setWithdrawing(true);
            await supabase.from("withdrawals").insert({
              provider_id: provider.id,
              amount: provider.wallet_balance,
              bank_name: provider.bank_name,
              account_number: provider.bank_account_number,
              account_name: provider.bank_account_name,
            });
            setWithdrawing(false);
            Alert.alert("Withdrawal requested", "The operations team will process this within 24 hours.");
          }
        }
      ]
    );
  }

  const monthTotal = bookings.reduce((s, b) => s + b.net_payout, 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Wallet Balance</Text>
        <Text style={styles.walletAmount}>{formatNaira(provider?.wallet_balance ?? 0)}</Text>
        <TouchableOpacity
          style={[styles.withdrawBtn, withdrawing && styles.withdrawBtnDisabled]}
          onPress={requestWithdrawal}
          disabled={withdrawing}
        >
          <Text style={styles.withdrawBtnText}>
            {withdrawing ? "Processing…" : "Withdraw to Bank"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* This Month */}
      <View style={styles.monthCard}>
        <Text style={styles.sectionTitle}>This Month</Text>
        <Text style={styles.monthTotal}>{formatNaira(monthTotal)}</Text>
        <Text style={styles.monthCount}>{bookings.length} visits completed</Text>
      </View>

      {/* Visit Breakdown */}
      <Text style={styles.sectionTitle}>Recent Visits</Text>
      {bookings.map((b) => (
        <View key={b.id} style={styles.row}>
          <View>
            <Text style={styles.rowService}>{b.service_type.replace(/_/g, " ")}</Text>
            <Text style={styles.rowDate}>
              {new Date(b.completed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowNet}>{formatNaira(b.net_payout)}</Text>
            <Text style={styles.rowGross}>Gross: {formatNaira(b.fee)}</Text>
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
  walletCard: {
    backgroundColor: "#064E3B", borderRadius: 16, padding: 24, alignItems: "center"
  },
  walletLabel: { fontSize: 13, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: 0.5 },
  walletAmount: { fontSize: 36, fontWeight: "bold", color: "#fff", marginVertical: 8 },
  withdrawBtn: {
    backgroundColor: "#059669", borderRadius: 10, paddingVertical: 12,
    paddingHorizontal: 24, marginTop: 8
  },
  withdrawBtnDisabled: { opacity: 0.5 },
  withdrawBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  monthCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: "#E5E7EB"
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  monthTotal: { fontSize: 28, fontWeight: "bold", color: "#111827" },
  monthCount: { fontSize: 13, color: "#6B7280" },
  row: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    flexDirection: "row", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#E5E7EB"
  },
  rowService: { fontSize: 14, fontWeight: "500", color: "#111827", textTransform: "capitalize" },
  rowDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowNet: { fontSize: 15, fontWeight: "700", color: "#059669" },
  rowGross: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
});
