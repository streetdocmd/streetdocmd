import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) { Alert.alert("Something went wrong", error.message); return; }
    router.push({ pathname: "/(auth)/reset-password", params: { email: email.trim() } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>StreetdocMD</Text>
        <Text style={styles.sub}>Reset your password</Text>

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
        <Text style={styles.hint}>
          We'll email you a code to reset your password.
        </Text>

        <TouchableOpacity
          style={[styles.btn, (loading || !email) && styles.btnDisabled]}
          onPress={sendCode}
          disabled={loading || !email}
        >
          <Text style={styles.btnText}>{loading ? "Sending..." : "Send code"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.register}>
          <Text style={styles.registerText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#064E3B", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 28, fontWeight: "bold", color: "#064E3B", textAlign: "center" },
  sub: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 28 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8,
  },
  hint: { fontSize: 12, color: "#888", marginBottom: 20 },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  register: { marginTop: 20, alignItems: "center" },
  registerText: { fontSize: 14, color: "#6B7280" },
});
