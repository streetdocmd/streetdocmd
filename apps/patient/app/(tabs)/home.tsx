import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { SERVICE_LABELS, ServiceType } from "@streetdocmd/shared";
import LegalUpdatePrompt from "../../components/LegalUpdatePrompt";
import { needsLegalAcceptance } from "../../lib/legal";

const SERVICES: ServiceType[] = [
  "general_consultation",
  "wellness_check",
  "wound_care",
  "elderly_review",
  "nursing_care",
  "physiotherapy_assessment",
];
// physiotherapy_session is intentionally not a front-door option — it's
// only ever a follow-up after a completed physiotherapy_assessment.

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [legalPrompt, setLegalPrompt] = useState<null | { firstTime: boolean }>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  // Re-check on focus so the "complete your profile" nudge disappears as
  // soon as they come back from editing it.
  useFocusEffect(useCallback(() => { loadUser(); }, []));

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("name, dob, gender, emergency_contact_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.name) setUserName(data.name.split(" ")[0]);
    setProfileIncomplete(!!data && (!data.dob || !data.gender || !data.emergency_contact_name));

    // Separate query so a missing column (migration 053 not yet applied)
    // can't break the greeting above.
    const { data: legal, error: legalErr } = await supabase
      .from("users")
      .select("terms_version, terms_accepted_at, privacy_policy_version, privacy_acknowledged_at")
      .eq("id", user.id)
      .maybeSingle();
    setLegalPrompt(!legalErr && needsLegalAcceptance(legal)
      ? { firstTime: !legal?.terms_accepted_at && !legal?.privacy_acknowledged_at }
      : null);
  }

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        Alert.alert("Location needed", "We use your location to find providers near you. You can enable it in Settings.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setLocationDenied(true);
    }
  }

  function selectService(service: ServiceType) {
    if (service === "custom_request") {
      router.push("/booking/custom-request");
      return;
    }
    if (service === "wellness_check") {
      router.push("/booking/lab-investigations");
      return;
    }
    router.push({ pathname: "/booking/choose-provider", params: { service } });
  }

  function serviceLabel(service: ServiceType): string {
    return service === "wellness_check" ? "Request Lab Investigations" : SERVICE_LABELS[service];
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {userName ? `Hello, ${userName} 👋` : "Hello 👋"}
        </Text>
        <Text style={styles.subheading}>What care do you need today?</Text>
        {!location && (
          <Text style={styles.locationNote}>
            {locationDenied ? "📍 Location is off — you can still enter your address when booking" : "📍 Getting your location…"}
          </Text>
        )}
      </View>

      {legalPrompt && (
        <LegalUpdatePrompt firstTime={legalPrompt.firstTime} onAccepted={() => setLegalPrompt(null)} />
      )}

      {profileIncomplete && (
        <TouchableOpacity style={styles.nudgeCard} onPress={() => router.push("/profile/edit")} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nudgeTitle}>Complete your medical profile</Text>
            <Text style={styles.nudgeSub}>Add your date of birth, gender and an emergency contact so your clinician arrives prepared.</Text>
          </View>
          <Text style={styles.nudgeArrow}>›</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.grid}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service}
            style={styles.card}
            onPress={() => selectService(service)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardTitle}>{serviceLabel(service)}</Text>
            {/* Providers set their own prices, so none is shown here */}
            <Text style={styles.cardPrice}>
              {service === "wellness_check" ? "Choose a package" : "See providers & prices"}
            </Text>
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
        style={styles.preferredCard}
        onPress={() => router.push("/booking/preferred-provider")}
        activeOpacity={0.8}
      >
        <Text style={styles.preferredIcon}>🔑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.preferredTitle}>Have a Preferred Provider?</Text>
          <Text style={styles.preferredSub}>Enter their code to book directly with them</Text>
        </View>
      </TouchableOpacity>

      {/* Planned features — visible but inert until built. */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>On the way</Text>
      {[
        { title: "Video Consultation", sub: "Speak to a doctor from home over a secure video call" },
        { title: "Care Plans", sub: "Monthly plans with included home visits for you or your family" },
      ].map(item => (
        <View key={item.title} style={styles.soonCard} accessibilityState={{ disabled: true }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.soonTitle}>{item.title}</Text>
            <Text style={styles.preferredSub}>{item.sub}</Text>
          </View>
          <Text style={styles.soonBadge}>COMING SOON</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },
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
  preferredCard: {
    marginTop: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  preferredIcon: { fontSize: 24 },
  nudgeCard: {
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12,
    padding: 14, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 10,
  },
  nudgeTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  nudgeSub: { fontSize: 12, color: "#4B5563", marginTop: 2, lineHeight: 17 },
  nudgeArrow: { fontSize: 24, color: "#D97706" },
  soonCard: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, opacity: 0.7,
  },
  soonTitle: { fontSize: 14, fontWeight: "600", color: "#374151" },
  soonBadge: {
    fontSize: 10, fontWeight: "700", color: "#6B7280", backgroundColor: "#F3F4F6",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: "hidden", letterSpacing: 0.4,
  },
  preferredTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  preferredSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
