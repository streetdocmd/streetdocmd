import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import FamilyMemberPicker from "../../components/FamilyMemberPicker";
import { SERVICE_PRICES, ServiceType } from "@streetdocmd/shared";

// Same "profession -> a representative bookable service_type" mapping the
// web app's follow-up/preferred-provider paths use — a preferred-provider
// request books whatever service that provider's profession offers.
const PROFESSION_SERVICE_TYPE: Record<string, ServiceType> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_session",
  lab_scientist: "general_consultation",
};

interface ProviderInfo {
  id: string;
  name: string;
  photo_url: string | null;
  specialty: string;
  profession: string;
  bio: string | null;
  rating: number;
  total_visits: number;
}

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function PreferredProviderScreen() {
  const router = useRouter();
  const { retarget } = useLocalSearchParams<{ retarget?: string }>();
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);

  async function lookupCode() {
    if (!code.trim()) return;
    setLooking(true);
    const { data, error } = await supabase
      .from("providers")
      .select("id, name, photo_url, specialty, profession, bio, rating, total_visits")
      .eq("referral_code", code.trim().toUpperCase())
      .eq("verification_status", "verified")
      .maybeSingle();
    setLooking(false);
    if (error || !data) { Alert.alert("Not found", "No provider found with that code."); return; }
    setProvider(data);
  }

  async function confirmRetarget() {
    if (!provider || !retarget) return;
    setBooking(true);
    const { error } = await supabase.rpc("retarget_booking", {
      p_booking_id: retarget,
      p_new_provider_id: provider.id,
    });
    setBooking(false);
    if (error) { Alert.alert("Error", error.message); return; }
    router.replace("/(tabs)/bookings");
  }

  async function getLocation() {
    setGeoState("locating");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setGeoState("denied"); return; }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const parts = [place?.street, place?.district, place?.city, place?.region].filter(Boolean);
        setAddress(parts.length ? parts.join(", ") : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setGeoState("ready");
    } catch {
      setGeoState("denied");
    }
  }

  async function confirmNewBooking() {
    if (!provider || !coords) return;
    setBooking(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBooking(false); return; }

    const serviceType = PROFESSION_SERVICE_TYPE[provider.profession] ?? "general_consultation";
    const fee = SERVICE_PRICES[serviceType];
    const commission = Math.round(fee * 0.2);

    const { data: newBooking, error } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        family_member_id: familyMemberId,
        targeted_provider_id: provider.id,
        service_type: serviceType,
        profession: provider.profession,
        patient_lat: coords.lat,
        patient_lng: coords.lng,
        patient_address: address,
        fee,
        commission,
        net_payout: fee - commission,
        status: "pending_payment",
        payment_status: "pending",
      })
      .select("id")
      .single();

    setBooking(false);
    if (error || !newBooking) { Alert.alert("Error", "Could not create booking. Please try again."); return; }
    router.push({ pathname: "/booking/payment", params: { bookingId: newBooking.id } });
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <Text style={s.title}>{retarget ? "Choose a different provider" : "Preferred Provider"}</Text>
        <Text style={s.subtitle}>Enter the code your provider shared with you</Text>
      </View>

      <View style={s.content}>
        {!provider ? (
          <View style={s.card}>
            <Text style={s.label}>Provider code</Text>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="e.g. 7K2PXQ"
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={[s.btn, (looking || !code) && s.btnDisabled]}
              onPress={lookupCode}
              disabled={looking || !code}
            >
              {looking ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Find Provider</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.providerCard}>
              {provider.photo_url ? (
                <Image source={{ uri: provider.photo_url }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarText}>{provider.name.charAt(0)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.providerName}>{provider.name}</Text>
                <Text style={s.providerSpecialty}>{provider.specialty}</Text>
                <Text style={s.providerMeta}>
                  {provider.rating > 0 ? `★ ${provider.rating.toFixed(1)}` : "New provider"} · {provider.total_visits} visits
                </Text>
              </View>
            </View>

            {retarget ? (
              <TouchableOpacity
                style={[s.bookBtn, booking && s.btnDisabled]}
                onPress={confirmRetarget}
                disabled={booking}
              >
                {booking ? <ActivityIndicator color="#fff" /> : <Text style={s.bookBtnText}>Request {provider.name}</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <FamilyMemberPicker onChange={setFamilyMemberId} />

                {geoState === "idle" && (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>Share your location</Text>
                    <Text style={s.cardDesc}>We'll send this to your provider.</Text>
                    <TouchableOpacity style={s.btn} onPress={getLocation}>
                      <Text style={s.btnText}>Allow location access</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {geoState === "locating" && (
                  <View style={s.card}><ActivityIndicator size="large" color="#1E6FD9" /></View>
                )}

                {geoState === "denied" && (
                  <View style={[s.card, { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }]}>
                    <Text style={[s.cardTitle, { color: "#B91C1C" }]}>Location access denied</Text>
                    <TouchableOpacity style={s.btn} onPress={getLocation}>
                      <Text style={s.btnText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {geoState === "ready" && coords && (
                  <>
                    <View style={s.addressCard}>
                      <Text style={{ fontSize: 18 }}>📍</Text>
                      <Text style={s.addressText} numberOfLines={2}>{address}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.bookBtn, booking && s.btnDisabled]}
                      onPress={confirmNewBooking}
                      disabled={booking}
                    >
                      {booking ? <ActivityIndicator color="#fff" /> : (
                        <Text style={s.bookBtnText}>Book with {provider.name}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: "#0D2B5E", padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#93C5FD", marginTop: 4 },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center",
  },
  label: { fontSize: 13, color: "#444", fontWeight: "500", alignSelf: "flex-start", marginBottom: 6 },
  codeInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10, width: "100%",
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: "700",
    textAlign: "center", letterSpacing: 4, marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  cardDesc: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 12 },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, width: "100%", alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  providerCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, flexDirection: "row",
    alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E5E7EB",
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#1E6FD9" },
  providerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  providerSpecialty: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  providerMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  addressCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  addressText: { fontSize: 13, color: "#374151", flex: 1 },
  bookBtn: { backgroundColor: "#1E6FD9", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  bookBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
