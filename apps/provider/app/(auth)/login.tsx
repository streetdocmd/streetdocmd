import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ProviderLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { Alert.alert("Login failed", error.message); return; }
    router.replace("/(tabs)/dispatch");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>StreetdocMD</Text>
        <Text style={styles.sub}>Provider Portal</Text>

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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, (loading || !email || !password) && styles.btnDisabled]}
          onPress={login}
          disabled={loading || !email || !password}
        >
          <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.register}>
          <Text style={styles.registerText}>
            New provider? <Text style={styles.registerLink}>Apply to join</Text>
          </Text>
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
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  register: { marginTop: 20, alignItems: "center" },
  registerText: { fontSize: 14, color: "#6B7280" },
  registerLink: { color: "#059669", fontWeight: "600" },
});