import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        setLoading(false);
        const m = error.message.toLowerCase();
        const msg = m.includes("invalid login credentials") ? "Incorrect email or password. Please try again."
          : m.includes("email not confirmed") ? "Please confirm your email first — open the link we sent to your inbox."
          : error.message;
        Alert.alert("Sign in failed", msg);
        return;
      }
      // The root layout routes on the new session (profile setup if
      // needed, otherwise home).
    } catch {
      setLoading(false);
      Alert.alert("Sign in failed", "Couldn't reach StreetdocMD. Check your internet connection and try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>StreetdocMD</Text>
        <Text style={styles.tagline}>Care. Anywhere. Anytime.</Text>

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
          textContentType="password"
        />

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, (loading || !email || !password) && styles.btnDisabled]}
          onPress={login}
          disabled={loading || !email || !password}
        >
          <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.register}>
          <Text style={styles.registerText}>
            New here? <Text style={styles.registerLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D2B5E", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 28, fontWeight: "bold", color: "#0D2B5E", textAlign: "center" },
  tagline: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 28 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  forgotPassword: { alignSelf: "flex-end", marginTop: -10, marginBottom: 16 },
  forgotPasswordText: { fontSize: 13, color: "#1E6FD9", fontWeight: "600" },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  register: { marginTop: 20, alignItems: "center" },
  registerText: { fontSize: 14, color: "#6B7280" },
  registerLink: { color: "#1E6FD9", fontWeight: "600" },
});