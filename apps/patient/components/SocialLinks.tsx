import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { SOCIAL_LINKS } from "@streetdocmd/shared";

// "Follow StreetdocMD" card — the account list lives in SOCIAL_LINKS (@streetdocmd/shared).
export default function SocialLinks() {
  if (SOCIAL_LINKS.length === 0) return null;
  return (
    <View style={s.card}>
      <Text style={s.title}>Follow StreetdocMD</Text>
      <View style={s.row}>
        {SOCIAL_LINKS.map(link => (
          <TouchableOpacity
            key={link.id}
            style={s.pill}
            onPress={() => Linking.openURL(link.url)}
            accessibilityRole="link"
            accessibilityLabel={`StreetdocMD on ${link.label}`}
            activeOpacity={0.7}
          >
            <Text style={s.pillLabel}>{link.label}</Text>
            <Text style={s.pillHandle}>{link.handle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  pill: { flex: 1, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: "#EFF6FF", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  pillLabel: { fontSize: 13, fontWeight: "700", color: "#1E6FD9" },
  pillHandle: { fontSize: 11, color: "#6B7280", marginTop: 1 },
});
