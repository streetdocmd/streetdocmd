import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

const SPECIALTIES = [
  "General Practitioner", "Nurse", "Paediatrician",
  "Gynaecologist", "Cardiologist", "Physiotherapist", "Other",
];

export default function ProviderRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [credentials, setCredentials] = useState("");
  const [mdcnNumber, setMdcnNumber] = useState("");
  const [nmcnNumber, setNmcnNumber] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [ndpr, setNdpr] = useState(false);
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!ndpr) {
      Alert.alert("Consent required", "Please accept the data privacy notice.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) { Alert.alert("Error", error.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (userId) {
      const { error: provErr } = await supabase.from("providers").insert({
        user_id: userId,
        name: name.trim(),
        phone: phone.trim(),
        specialty,
        credentials: credentials.trim(),
        mdcn_number: mdcnNumber.trim() || null,
        nmcn_number: nmcnNumber.trim() || null,
        years_experience: parseInt(yearsExp) || 0,
        verification_status: "pending",
      });
      if (provErr) {
        Alert.alert("Error", "Account created but profile setup failed. Contact support.");
      }
    }
    setLoading(false);
    router.replace("/(auth)/pending");
  }

  const ready = name && email && password.length >= 8 && specialty && credentials && ndpr;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>StreetdocMD</Text>
          <Text style={styles.tagline}>Join as a healthcare provider</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Dr. Amara Nwosu" autoCapitalize="words" />

          <Text style={styles.label}>Email address</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="08012345678" keyboardType="phone-pad" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="At least 8 characters" secureTextEntry />

          <Text style={styles.label}>Specialty</Text>
          <View style={styles.specialtyGrid}>
            {SPECIALTIES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.specialtyChip, specialty === s && styles.specialtyChipActive]}
                onPress={() => setSpecialty(s)}
              >
                <Text style={[styles.specialtyText, specialty === s && styles.specialtyTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Credentials (e.g. MBBS, RN, BNSc)</Text>
          <TextInput style={styles.input} value={credentials} onChangeText={setCredentials}
            placeholder="MBBS" autoCapitalize="characters" />

          <Text style={styles.label}>MDCN Number (doctors)</Text>
          <TextInput style={styles.input} value={mdcnNumber} onChangeText={setMdcnNumber}
            placeholder="Optional" />

          <Text style={styles.label}>NMCN Number (nurses)</Text>
          <TextInput style={styles.input} value={nmcnNumber} onChangeText={setNmcnNumber}
            placeholder="Optional" />

          <Text style={styles.label}>Years of experience</Text>
          <TextInput style={styles.input} value={yearsExp} onChangeText={setYearsExp}
            placeholder="5" keyboardType="number-pad" />

          <TouchableOpacity style={styles.consentRow} onPress={() => setNdpr(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, ndpr && styles.checkboxChecked]}>
              {ndpr && <Text style={styles.checkmark}>checkmark</Text>}
            </View>
            <Text style={styles.consentText}>
              I consent to StreetdocMD processing my professional and health data under the
              Nigeria Data Protection Regulation (NDPR).
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, (!ready || loading) && styles.btnDisabled]}
            onPress={register}
            disabled={!ready || loading}
          >
            <Text style={styles.btnText}>{loading ? "Submitting..." : "Submit Application"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#064E3B" },
  scroll: { padding: 20, paddingVertical: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 26, fontWeight: "bold", color: "#064E3B", textAlign: "center" },
  tagline: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  specialtyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  specialtyChip: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  specialtyChipActive: { backgroundColor: "#059669", borderColor: "#059669" },
  specialtyText: { fontSize: 13, color: "#374151" },
  specialtyTextActive: { color: "#fff", fontWeight: "600" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#059669", borderColor: "#059669" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  consentText: { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18 },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  back: { marginTop: 18, alignItems: "center" },
  backText: { fontSize: 14, color: "#6B7280" },
});