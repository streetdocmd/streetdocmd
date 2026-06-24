import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [ndpr, setNdpr] = useState(false);
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!ndpr) {
      Alert.alert("Consent required", "Please accept the data privacy notice to continue.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) { Alert.alert("Error", error.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from("users").insert({
        id: userId,
        name: name.trim(),
        phone: phone.trim(),
        role: "patient",
        ndpr_consent: true,
      });
    }
    setLoading(false);
    router.replace("/(tabs)/home");
  }

  const ready = name.trim() && email.trim() && password.length >= 8 && ndpr;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>StreetdocMD</Text>
          <Text style={styles.tagline}>Create your patient account</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Segun Ogunlana"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="08012345678"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
          />

          {/* NDPR Consent */}
          <TouchableOpacity style={styles.consentRow} onPress={() => setNdpr(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, ndpr && styles.checkboxChecked]}>
              {ndpr && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I consent to StreetdocMD collecting and processing my health data in accordance with
              the Nigeria Data Protection Regulation (NDPR). My data will only be used to provide
              healthcare services.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, (!ready || loading) && styles.btnDisabled]}
            onPress={register}
            disabled={!ready || loading}
          >
            <Text style={styles.btnText}>{loading ? "Creating account..." : "Create Account"}</Text>
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
  container: { flex: 1, backgroundColor: "#0D2B5E" },
  scroll: { justifyContent: "center", padding: 20, paddingVertical: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 26, fontWeight: "bold", color: "#0D2B5E", textAlign: "center" },
  tagline: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#1E6FD9", borderColor: "#1E6FD9" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  consentText: { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18 },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  back: { marginTop: 18, alignItems: "center" },
  backText: { fontSize: 14, color: "#6B7280" },
});