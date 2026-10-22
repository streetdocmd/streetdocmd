import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { createBooking } from "../../lib/bookings";
import FamilyMemberPicker from "../../components/FamilyMemberPicker";
import SchedulePicker from "../../components/SchedulePicker";
import { ServiceType, SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function ConfirmBookingScreen() {
  // providerId/providerName/price come from choose-provider when the patient picked someone;
  // without them we dispatch the nearest available provider.
  const { service, description, providerId, providerName, price } = useLocalSearchParams<{
    service: ServiceType; description?: string; providerId?: string; providerName?: string; price?: string;
  }>();
  const router = useRouter();
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(true);

  // Display only — the server sets the real price (this provider's own price)
  const fee = providerId && price ? Number(price) : null;

  async function getLocation() {
    setGeoState("locating");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGeoState("denied");
      return;
    }

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

  async function bookNow() {
    if (!coords || !scheduleReady) return;
    setBooking(true);
    try {
      const bookingId = await createBooking({
        service_type: service,
        targeted_provider_id: providerId ?? null,
        family_member_id: familyMemberId,
        patient_lat: coords.lat,
        patient_lng: coords.lng,
        patient_address: address,
        scheduled_at: scheduledAt,
        notes: description ?? null,
      });
      // A chosen provider gets the request to accept or decline; otherwise the
      // payment-gated dispatch finds the nearest eligible provider once paid.
      router.push({ pathname: "/booking/payment", params: { bookingId } });
    } catch (e) {
      Alert.alert("Couldn't book", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{SERVICE_LABELS[service]}</Text>
          <Text style={styles.subtitle}>{providerName ?? "Nearest available provider"}</Text>
        </View>
        {fee !== null && <Text style={styles.price}>{formatNaira(fee)}</Text>}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <FamilyMemberPicker onChange={setFamilyMemberId} />
        <SchedulePicker onChange={(v, ready) => { setScheduledAt(v); setScheduleReady(ready); }} />

        {geoState === "idle" && (
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>📍</Text>
            <Text style={styles.cardTitle}>Share your location</Text>
            <Text style={styles.cardSub}>
              {providerName ? `So ${providerName} knows where to come.` : "We use your location to find the nearest available provider."}
            </Text>
            <TouchableOpacity style={styles.btn} onPress={getLocation}>
              <Text style={styles.btnText}>Allow location access</Text>
            </TouchableOpacity>
          </View>
        )}

        {geoState === "locating" && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#1E6FD9" />
            <Text style={styles.loadingText}>Getting your location…</Text>
          </View>
        )}

        {geoState === "denied" && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorTitle}>Location access denied</Text>
            <Text style={styles.errorSub}>Please enable location access and try again.</Text>
            <TouchableOpacity style={styles.btn} onPress={getLocation}>
              <Text style={styles.btnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {geoState === "ready" && coords && (
          <>
            <View style={styles.addressCard}>
              <Text style={styles.addressEmoji}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>Your location</Text>
                <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
              </View>
              <TouchableOpacity onPress={getLocation}>
                <Text style={styles.updateText}>Update</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.bookBtn, (booking || !scheduleReady) && styles.btnDisabled]}
              onPress={bookNow}
              disabled={booking || !scheduleReady}
            >
              {booking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.bookBtnText}>
                  {providerName && fee !== null
                    ? `Book with ${providerName} · ${formatNaira(fee)}`
                    : scheduledAt ? "Confirm Booking" : "Book Now"}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={styles.footnote}>
              {providerName
                ? `${providerName} will be notified and can accept or decline. Payment is due before they set off.`
                : "We'll match you with the nearest available provider. You'll see the price before you pay."}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    backgroundColor: "#0D2B5E", padding: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  price: { fontSize: 16, color: "#93C5FD", fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center",
  },
  cardError: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  cardEmoji: { fontSize: 36, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 16 },
  loadingText: { color: "#6B7280", marginTop: 12, fontSize: 14 },
  errorTitle: { fontSize: 15, fontWeight: "600", color: "#B91C1C", marginBottom: 4 },
  errorSub: { fontSize: 13, color: "#DC2626", textAlign: "center", marginBottom: 16 },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  addressCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB",
    flexDirection: "row", alignItems: "flex-start", gap: 10,
  },
  addressEmoji: { fontSize: 18, marginTop: 2 },
  addressLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 2 },
  addressText: { fontSize: 13, color: "#374151", lineHeight: 18 },
  updateText: { fontSize: 12, color: "#1E6FD9", fontWeight: "600" },
  bookBtn: {
    backgroundColor: "#1E6FD9", borderRadius: 12, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  bookBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footnote: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 4 },
});
