import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import SocialLinks from "../../components/SocialLinks";
import { supabase } from "../../lib/supabase";
import FamilyMembersManager from "../../components/FamilyMembersManager";
import LegalDocumentModal from "../../components/LegalDocumentModal";
import { PATIENT_TERMS, PRIVACY_POLICY, type LegalDocument } from "@streetdocmd/shared";
import { formatLegalDate, TERMS_VERSION, PRIVACY_VERSION } from "../../lib/legal";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string; relationship: string }[]>([]);

  // Reload on focus so edits made on /profile/edit show up on return.
  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  async function loadProfile() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
    setUser(data);
    const { data: family } = await supabase
      .from("family_members")
      .select("id, name, relationship")
      .order("created_at", { ascending: true });
    setFamilyMembers(family ?? []);
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
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <InfoRow label="Date of Birth" value={user.dob ?? "Not set"} />
        <InfoRow label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : "Not set"} />
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

      <FamilyMembersManager initialMembers={familyMembers} />

      {user.emergency_contact_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <InfoRow label="Name" value={user.emergency_contact_name} />
          <InfoRow label="Phone" value={user.emergency_contact_phone} />
          <InfoRow label="Relationship" value={user.emergency_contact_relationship} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <LegalRow
          title="Patient Terms of Service"
          status={acceptanceStatus("Accepted", user.terms_version, user.terms_accepted_at, TERMS_VERSION)}
          onPress={() => setOpenDoc(PATIENT_TERMS)}
        />
        <LegalRow
          title="Privacy Policy"
          status={acceptanceStatus("Acknowledged", user.privacy_policy_version, user.privacy_acknowledged_at, PRIVACY_VERSION)}
          onPress={() => setOpenDoc(PRIVACY_POLICY)}
          last
        />
      </View>
      <LegalDocumentModal doc={openDoc} visible={!!openDoc} onClose={() => setOpenDoc(null)} />

      <SocialLinks />

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function acceptanceStatus(
  verb: string,
  version: string | null | undefined,
  at: string | null | undefined,
  current: string,
): { text: string; outdated: boolean } {
  const date = formatLegalDate(at);
  if (!version || !date) return { text: `Not yet ${verb.toLowerCase()}`, outdated: true };
  return {
    text: `${verb} version ${version} on ${date}${version !== current ? ` · version ${current} awaiting review` : ""}`,
    outdated: version !== current,
  };
}

function LegalRow({
  title, status, onPress, last,
}: {
  title: string;
  status: { text: string; outdated: boolean };
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.legalRow, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.legalTitle}>{title}</Text>
        <Text style={[styles.legalStatus, status.outdated && styles.legalStatusOutdated]}>{status.text}</Text>
      </View>
      <Text style={styles.legalView}>View ›</Text>
    </TouchableOpacity>
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
  legalRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  legalTitle: { fontSize: 14, color: "#111827", fontWeight: "500" },
  legalStatus: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  legalStatusOutdated: { color: "#B45309" },
  legalView: { fontSize: 13, color: "#1E6FD9", fontWeight: "600" },
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
