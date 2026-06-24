import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function EditProfileScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bloodGroup, setBloodGroup] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("users")
      .select("blood_group, known_conditions, current_medications, allergies, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship")
      .eq("id", user.id)
      .single();

    if (data) {
      setBloodGroup(data.blood_group ?? "");
      setConditions((data.known_conditions ?? []).join(", "));
      setAllergies((data.allergies ?? []).join(", "));
      setMedications((data.current_medications ?? []).join(", "));
      setEmergencyName(data.emergency_contact_name ?? "");
      setEmergencyPhone(data.emergency_contact_phone ?? "");
      setEmergencyRelationship(data.emergency_contact_relationship ?? "");
    }
    setLoading(false);
  }

  function parseList(val: string) {
    return val.split(",").map(s => s.trim()).filter(Boolean);
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("users").update({
      blood_group: bloodGroup || null,
      known_conditions: parseList(conditions),
      allergies: parseList(allergies),
      current_medications: parseList(medications),
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      emergency_contact_relationship: emergencyRelationship || null,
    }).eq("id", userId);
    setSaving(false);
    if (error) { Alert.alert("Error", "Could not save profile."); return; }
    Alert.alert("Saved", "Your medical profile has been updated.", [
      { text: "OK", onPress: () => router.back() }
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      <Text style={s.section}>Blood Group</Text>
      <View style={s.chipRow}>
        {BLOOD_GROUPS.map(bg => (
          <TouchableOpacity
            key={bg}
            style={[s.chip, bloodGroup === bg && s.chipActive]}
            onPress={() => setBloodGroup(bg === bloodGroup ? "" : bg)}
          >
            <Text style={[s.chipText, bloodGroup === bg && s.chipTextActive]}>{bg}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.section}>Known Conditions</Text>
      <TextInput
        style={s.input}
        value={conditions}
        onChangeText={setConditions}
        placeholder="e.g. Hypertension, Diabetes (comma-separated)"
        multiline
      />

      <Text style={s.section}>Allergies</Text>
      <TextInput
        style={s.input}
        value={allergies}
        onChangeText={setAllergies}
        placeholder="e.g. Penicillin, Peanuts (comma-separated)"
        multiline
      />

      <Text style={s.section}>Current Medications</Text>
      <TextInput
        style={s.input}
        value={medications}
        onChangeText={setMedications}
        placeholder="e.g. Lisinopril 10mg, Metformin 500mg (comma-separated)"
        multiline
      />

      <Text style={s.section}>Emergency Contact</Text>
      <TextInput style={s.input} value={emergencyName} onChangeText={setEmergencyName}
        placeholder="Full name" />
      <TextInput style={s.input} value={emergencyPhone} onChangeText={setEmergencyPhone}
        placeholder="Phone number" keyboardType="phone-pad" />
      <TextInput style={s.input} value={emergencyRelationship} onChangeText={setEmergencyRelationship}
        placeholder="Relationship (e.g. Spouse, Parent)" />

      <TouchableOpacity
        style={[s.btn, saving && s.btnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={s.btnText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "#1E6FD9", borderColor: "#1E6FD9" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginVertical: 6,
  },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});