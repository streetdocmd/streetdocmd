import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { normalizePhone, PHONE_ERROR } from "../lib/phone";
import { createPatientProfile, notifyProfileChanged } from "../lib/profile";
import { TERMS_VERSION, PRIVACY_VERSION } from "../lib/legal";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "../components/LegalAcceptanceFields";

// Reached when a signed-in user has no patient profile row yet — e.g. the
// details saved at sign-up clashed with another account's phone number, or
// the account predates this flow. The root layout routes here and moves
// on to home once the row exists.
export default function CompleteProfileScreen() {
  const params = useLocalSearchParams<{ error?: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Both unchecked by default — the documents require an affirmative tick.
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const legalOk = legal.terms && legal.privacy;
  const [error, setError] = useState(params.error ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      if (typeof meta.name === "string") setName(meta.name);
      if (typeof meta.phone === "string") setPhone(meta.phone);
    });
  }, []);

  const nameError = name.trim().length < 2 ? "Please enter your full name" : "";
  const phoneNorm = normalizePhone(phone);
  const phoneError = phoneNorm ? "" : PHONE_ERROR;

  async function save() {
    if (saving) return;
    setSubmitted(true);
    if (nameError || !phoneNorm) return;
    if (!legalOk) {
      setError("Please agree to the Terms of Service and acknowledge the Privacy Policy to continue.");
      return;
    }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const res = await createPatientProfile(
      user.id, user.email, name.trim().replace(/\s+/g, " "), phoneNorm,
      { context: "complete_profile", termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
    );
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong. Please try again."); return; }
    notifyProfileChanged();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>StreetdocMD</Text>
          <Text style={styles.title}>Finish setting up</Text>
          <Text style={styles.tagline}>Confirm your details to start booking care.</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Chukwuemeka Obi" autoCapitalize="words" />
          {submitted && nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}

          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08012345678" keyboardType="phone-pad" />
          {submitted && phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

          <LegalAcceptanceFields
            value={legal}
            onChange={next => { setLegal(next); if (next.terms && next.privacy) setError(""); }}
            showErrors={submitted}
          />

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (!legalOk || saving) && styles.btnDisabled]}
            onPress={save}
            disabled={!legalOk || saving}
          >
            <Text style={styles.btnText}>{saving ? "Saving..." : "Continue"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Sign out", "Sign out and finish later?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: signOut },
            ])}
            style={styles.back}
          >
            <Text style={styles.backText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D2B5E" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, paddingVertical: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 22, fontWeight: "bold", color: "#0D2B5E", textAlign: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  tagline: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4, marginBottom: 24 },
  label: { fontSize: 14, color: "#374151", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  fieldError: { color: "#DC2626", fontSize: 12, marginTop: -10, marginBottom: 12 },
  errorBox: {
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", color: "#B91C1C",
    borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16, overflow: "hidden",
  },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  back: { marginTop: 18, alignItems: "center" },
  backText: { fontSize: 14, color: "#6B7280" },
});
