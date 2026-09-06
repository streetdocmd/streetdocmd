import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function resetPassword() {
    if (password.length < 8) { Alert.alert("Password too short", "Use at least 8 characters."); return; }
    if (password !== confirm) { Alert.alert("Passwords don't match", "Check both password fields."); return; }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setLoading(false);
      Alert.alert("Invalid code", "That code is incorrect or has expired. Please request a new one.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { Alert.alert("Something went wrong", updateError.message); return; }

    Alert.alert("Password updated", "Sign in with your new password.");
    router.replace("/(auth)/login");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>StreetdocMD</Text>
        <Text style={styles.tagline}>Enter the code we emailed you</Text>

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

        <Text style={styles.label}>Reset code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="8-digit code"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, (loading || !email || !code || !password) && styles.btnDisabled]}
          onPress={resetPassword}
          disabled={loading || !email || !code || !password}
        >
          <Text style={styles.btnText}>{loading ? "Resetting..." : "Reset password"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.register}>
          <Text style={styles.registerText}>Didn't get a code? Send again</Text>
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
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  register: { marginTop: 20, alignItems: "center" },
  registerText: { fontSize: 14, color: "#6B7280" },
});
