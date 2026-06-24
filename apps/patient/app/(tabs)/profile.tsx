import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
    setUser(data);
  }

  async function signOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        }
      }
    ]);
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name?.[0] ?? "?"}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/profile/edit")}>
          <Text style={styles.editBtnText}>Edit Medical Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <InfoRow label="Blood Group" value={user.blood_group ?? "Not set"} />
        <InfoRow
          label="Known Conditions"
          value={user.known_conditions?.join(", ") || "None recorded"}
        />
        <InfoRow
          label="Allergies"
          value={user.allergies?.join(", ") || "None recorded"}
        />
        <InfoRow
          label="Current Medications"
          value={user.current_medications?.join(", ") || "None recorded"}
        />
      </View>

      {user.emergency_contact_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <InfoRow label="Name" value={user.emergency_contact_name} />
          <InfoRow label="Phone" value={user.emergency_contact_phone} />
          <InfoRow label="Relationship" value={user.emergency_contact_relationship} />
        </View>
      )}

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#1E6FD9", alignItems: "center", justifyContent: "center", marginBottom: 12
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  phone: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  section: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB"
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  infoLabel: { fontSize: 14, color: "#6B7280" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500", flex: 1, textAlign: "right" },
  signOutBtn: {
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8
  },
  signOutText: { color: "#DC2626", fontWeight: "600", fontSize: 15 },
  editBtn: {
    marginTop: 12, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8,
  },
  editBtnText: { color: "#1E6FD9", fontWeight: "600", fontSize: 13 },
});
