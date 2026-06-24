import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function PendingScreen() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🕐</Text>
        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.body}>
          Thank you for applying to join StreetdocMD. Our team is reviewing your credentials
          and will verify your account within 24–48 hours.
        </Text>
        <Text style={styles.body}>
          You will receive an email once your account is approved. After approval, log back in
          to access the full provider portal.
        </Text>
        <View style={styles.steps}>
          <Step done text="Application submitted" />
          <Step done={false} text="Credentials verified by StreetdocMD team" />
          <Step done={false} text="Account activated — blue tick awarded" />
        </View>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Step({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.dot, done && styles.dotDone]}>
        {done && <Text style={styles.dotCheck}>✓</Text>}
      </View>
      <Text style={[styles.stepText, done && styles.stepTextDone]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#064E3B", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28, gap: 16 },
  icon: { fontSize: 48, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#064E3B", textAlign: "center" },
  body: { fontSize: 14, color: "#6B7280", lineHeight: 22, textAlign: "center" },
  steps: { gap: 12, marginVertical: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: "#059669", borderColor: "#059669" },
  dotCheck: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepText: { fontSize: 13, color: "#9CA3AF", flex: 1 },
  stepTextDone: { color: "#111827", fontWeight: "500" },
  btn: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10,
    paddingVertical: 12, alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#6B7280", fontWeight: "600" },
});