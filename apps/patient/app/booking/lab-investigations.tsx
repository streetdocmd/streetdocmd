import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SERVICE_PRICES, formatNaira } from "@streetdocmd/shared";

export default function LabInvestigationsChoiceScreen() {
  const router = useRouter();

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Request Lab Investigations</Text>
        <Text style={s.subtitle}>Choose a curated wellness package, or pick the specific tests you need.</Text>
      </View>

      <TouchableOpacity
        style={s.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: "/booking/confirm", params: { service: "wellness_check" } })}
      >
        <Text style={s.cardIcon}>🌿</Text>
        <Text style={s.cardTitle}>Wellness Check Package</Text>
        <Text style={s.cardDesc}>A curated panel of routine screening tests — blood tests, urinalysis, and more.</Text>
        <Text style={s.cardPrice}>{formatNaira(SERVICE_PRICES.wellness_check)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.card}
        activeOpacity={0.8}
        onPress={() => router.push("/booking/lab-investigations-custom")}
      >
        <Text style={s.cardIcon}>🔬</Text>
        <Text style={s.cardTitle}>Choose Specific Tests</Text>
        <Text style={s.cardDesc}>Search and select exactly the investigations you need from our lab partner's test menu.</Text>
        <Text style={s.cardPrice}>Priced per test</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16, gap: 12 },
  header: { marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 18,
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardDesc: { fontSize: 13, color: "#6B7280", marginTop: 4, lineHeight: 18 },
  cardPrice: { fontSize: 14, fontWeight: "700", color: "#1E6FD9", marginTop: 10 },
});
