import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { SERVICE_LABELS, SERVICE_PRICES, ServiceType, formatNaira } from "@streetdocmd/shared";

const SERVICES: ServiceType[] = [
  "general_consultation",
  "blood_pressure_check",
  "malaria_typhoid_test",
  "wound_care",
  "elderly_review",
  "nursing_care",
];

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadUser();
    requestLocation();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();
    if (data?.name) setUserName(data.name.split(" ")[0]);
  }

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location needed", "We need your location to find nearby providers.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }

  function selectService(service: ServiceType) {
    if (service === "custom_request") {
      router.push("/booking/custom-request");
      return;
    }
    router.push({ pathname: "/booking/select-provider", params: { service } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {userName ? `Hello, ${userName} 👋` : "Hello 👋"}
        </Text>
        <Text style={styles.subheading}>What care do you need today?</Text>
        {!location && (
          <Text style={styles.locationNote}>📍 Getting your location…</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service}
            style={styles.card}
            onPress={() => selectService(service)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardTitle}>{SERVICE_LABELS[service]}</Text>
            <Text style={styles.cardPrice}>{formatNaira(SERVICE_PRICES[service])}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.card, styles.cardCustom]}
          onPress={() => selectService("custom_request")}
          activeOpacity={0.8}
        >
          <Text style={styles.cardTitle}>Custom Request</Text>
          <Text style={styles.cardPrice}>Describe your need</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.panicButton}
        onPress={() =>
          Alert.alert(
            "Emergency Call",
            "Call StreetdocMD operations line?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Call Now", onPress: () => Linking.openURL("tel:+2348000000000") },
            ]
          )
        }
      >
        <Text style={styles.panicText}>🚨 Emergency — Call Operations</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  subheading: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  locationNote: { fontSize: 12, color: "#9CA3AF", marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "47%", backgroundColor: "#fff", borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardCustom: { width: "100%", backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#111827", lineHeight: 18 },
  cardPrice: { fontSize: 12, color: "#1E6FD9", marginTop: 6, fontWeight: "500" },
  panicButton: {
    marginTop: 28, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 12, padding: 16, alignItems: "center",
  },
  panicText: { color: "#DC2626", fontWeight: "600", fontSize: 14 },
});
