import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Switch, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prov } = await supabase
      .from("providers")
      .select("id, name, phone, specialty, credentials, verification_status, available, bank_name, bank_account_number, bank_account_name, rating, total_visits")
      .eq("user_id", user.id)
      .single();
    if (prov) {
      setProvider(prov);
      setBankName(prov.bank_name ?? "");
      setAccountNumber(prov.bank_account_number ?? "");
      setAccountName(prov.bank_account_name ?? "");
    }
    setLoading(false);
  }

  async function toggleAvailability() {
    const next = !provider.available;
    setProvider((p: any) => ({ ...p, available: next }));
    await supabase.from("providers").update({ available: next }).eq("id", provider.id);
  }

  async function saveBankDetails() {
    setSaving(true);
    const { error } = await supabase.from("providers").update({
      bank_name: bankName,
      bank_account_number: accountNumber,
      bank_account_name: accountName,
    }).eq("id", provider.id);
    setSaving(false);
    if (error) Alert.alert("Error", "Could not save bank details.");
    else Alert.alert("Saved", "Bank details updated.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{provider?.name?.[0] ?? "?"}</Text>
        </View>
        <Text style={styles.name}>{provider?.name}</Text>
        <Text style={styles.specialty}>{provider?.specialty} · {provider?.credentials}</Text>
        <View style={[styles.badge,
          provider?.verification_status === "verified" ? styles.badgeGreen : styles.badgeAmber]}>
          <Text style={[styles.badgeText,
            provider?.verification_status === "verified" ? styles.badgeTextGreen : styles.badgeTextAmber]}>
            {provider?.verification_status === "verified" ? "Verified" : provider?.verification_status ?? "pending"}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{provider?.total_visits ?? 0}</Text>
          <Text style={styles.statLabel}>Total Visits</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{provider?.rating ? provider.rating.toFixed(1) : "—"}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Availability */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Available for Bookings</Text>
            <Text style={styles.sectionSub}>Turn off when you cannot accept visits</Text>
          </View>
          <Switch
            value={provider?.available ?? false}
            onValueChange={toggleAvailability}
            trackColor={{ false: "#D1D5DB", true: "#059669" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Bank details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bank Details</Text>
        <Text style={styles.sectionSub}>Used for wallet withdrawals</Text>
        <TextInput
          style={styles.input}
          value={bankName}
          onChangeText={setBankName}
          placeholder="Bank name (e.g. Access Bank)"
        />
        <TextInput
          style={styles.input}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder="Account number"
          keyboardType="number-pad"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          value={accountName}
          onChangeText={setAccountName}
          placeholder="Account name"
        />
        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={saveBankDetails}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? "Saving..." : "Save Bank Details"}</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    alignItems: "center", paddingVertical: 24, backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB",
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#064E3B",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  specialty: { fontSize: 13, color: "#6B7280", marginTop: 2, marginBottom: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeGreen: { backgroundColor: "#D1FAE5" },
  badgeAmber: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextGreen: { color: "#065F46" },
  badgeTextAmber: { color: "#92400E" },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB",
  },
  statVal: { fontSize: 24, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  section: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB", gap: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  sectionSub: { fontSize: 12, color: "#9CA3AF" },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827",
  },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  logoutBtn: {
    borderWidth: 1, borderColor: "#EF4444", borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  logoutText: { color: "#EF4444", fontWeight: "600", fontSize: 15 },
});