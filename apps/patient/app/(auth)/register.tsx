import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { normalizePhone, PHONE_ERROR } from "../../lib/phone";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../lib/legal";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "../../components/LegalAcceptanceFields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlySignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Couldn't reach StreetdocMD. Check your internet connection and try again.";
  return message;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Both unchecked by default — the documents require an affirmative tick.
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const legalOk = legal.terms && legal.privacy;
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    name: name.trim().length < 2 ? "Please enter your full name" : "",
    email: !EMAIL_RE.test(email.trim()) ? "Please enter a valid email address" : "",
    phone: !normalizePhone(phone) ? PHONE_ERROR : "",
    password: password.length < 8 ? "Password must be at least 8 characters" : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function register() {
    if (loading) return;
    setSubmitted(true);
    if (hasErrors) return;
    if (!legalOk) {
      Alert.alert(
        "Please review",
        "Please agree to the Terms of Service and acknowledge the Privacy Policy to continue.",
      );
      return;
    }
    setLoading(true);
    try {
      // name/phone and the two separate ticks (with the document versions
      // shown) ride along as auth metadata; the root layout creates the
      // patient profile row from them as soon as there's a session
      // (immediately, or after the email is confirmed) and records the
      // acceptance with the server time of this sign-up request.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim().replace(/\s+/g, " "),
            phone: normalizePhone(phone),
            terms_accepted: legal.terms,
            terms_version: TERMS_VERSION,
            privacy_acknowledged: legal.privacy,
            privacy_policy_version: PRIVACY_VERSION,
          },
        },
      });
      if (error) {
        Alert.alert("Couldn't create account", friendlySignUpError(error.message));
        setLoading(false);
        return;
      }
      if (!data.session) {
        // Email confirmation is switched on for this project.
        setLoading(false);
        Alert.alert(
          "Confirm your email",
          `We've sent a confirmation link to ${email.trim()}. Open it, then come back and sign in.`,
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
        );
        return;
      }
      // Signed in — the root layout takes it from here (profile setup → home).
    } catch {
      setLoading(false);
      Alert.alert("Couldn't create account", "Couldn't reach StreetdocMD. Check your internet connection and try again.");
    }
  }

  const ready = legalOk && !loading;

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
          {submitted && errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

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
          {submitted && errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="08012345678"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          {submitted && errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            textContentType="newPassword"
          />
          {submitted && errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

          <LegalAcceptanceFields value={legal} onChange={setLegal} showErrors={submitted} />

          <TouchableOpacity
            style={[styles.btn, !ready && styles.btnDisabled]}
            onPress={register}
            disabled={!ready}
          >
            <Text style={styles.btnText}>{loading ? "Creating account..." : "Create Account"}</Text>
          </TouchableOpacity>
          {!legalOk && !loading ? <Text style={styles.hint}>Tick both boxes above to continue.</Text> : null}

          <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={styles.back}>
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
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  fieldError: { color: "#DC2626", fontSize: 12, marginTop: -10, marginBottom: 12 },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  hint: { fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  back: { marginTop: 18, alignItems: "center" },
  backText: { fontSize: 14, color: "#6B7280" },
});