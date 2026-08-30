import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import {
  ServiceType, SERVICE_LABELS, SERVICE_PRICES, SERVICE_PROFESSION,
  formatNaira, calculateCommission, calculateNetPayout
} from "@streetdocmd/shared";

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function ConfirmBookingScreen() {
  const { service, description } = useLocalSearchParams<{ service: ServiceType; description?: string }>();
  const router = useRouter();
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);

  const fee = SERVICE_PRICES[service];

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
    if (!coords) return;
    setBooking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBooking(false);
      return;
    }

    const commission = calculateCommission(fee);

    const { data: newBooking, error } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        service_type: service,
        // Without this, every mobile booking silently defaults to
        // profession='doctor' at the database level regardless of the
        // service requested (e.g. a wound_care booking would dispatch to
        // a doctor instead of a nurse) — see the Pass 1/3 merge report.
        profession: SERVICE_PROFESSION[service],
        patient_lat: coords.lat,
        patient_lng: coords.lng,
        patient_address: address,
        fee,
        commission,
        net_payout: calculateNetPayout(fee),
        status: "pending_payment",
        payment_status: "pending",
        ...(description ? { notes: description } : {}),
      })
      .select("id")
      .single();

    setBooking(false);

    if (error || !newBooking) {
      Alert.alert("Error", "Could not create booking. Please try again.");
      return;
    }

    // No provider is chosen here — the payment-gated dispatch trigger finds
    // the nearest eligible provider once payment is confirmed.
    router.push({ pathname: "/booking/payment", params: { bookingId: newBooking.id } });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{SERVICE_LABELS[service]}</Text>
        <Text style={styles.price}>{formatNaira(fee)}</Text>
      </View>

      <View style={styles.content}>
        {geoState === "idle" && (
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>📍</Text>
            <Text style={styles.cardTitle}>Share your location</Text>
            <Text style={styles.cardSub}>We use your location to find the nearest available provider.</Text>
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
              style={[styles.bookBtn, booking && styles.btnDisabled]}
              onPress={bookNow}
              disabled={booking}
            >
              {booking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.bookBtnText}>Book Now · {formatNaira(fee)}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.footnote}>
              We'll match you with the nearest available provider. Payment due after confirmation.
            </Text>
          </>
        )}
      </View>
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
