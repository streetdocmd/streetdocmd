import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { BOOKING_STATUS_LABELS } from "@streetdocmd/shared";

export default function TrackingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [booking, setBooking] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadBooking();
    return subscribeToBookingStatus();
  }, [bookingId]);

  useEffect(() => {
    if (!booking?.provider_id) return;
    return subscribeToProviderLocation();
  }, [booking?.provider_id]);

  async function loadBooking() {
    const { data } = await supabase
      .from("bookings")
      .select("*, providers!bookings_provider_id_fkey(id, name, phone, specialty, rating, lat, lng)")
      .eq("id", bookingId)
      .single();

    setBooking(data);
    if (data?.providers) {
      setProvider(data.providers);
      if (data.providers.lat && data.providers.lng) {
        setProviderLocation({ lat: data.providers.lat, lng: data.providers.lng });
      }
    }
  }

  function subscribeToProviderLocation() {
    if (!booking?.provider_id) return;

    const channel = supabase
      .channel(`provider-location-${booking.provider_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "providers", filter: `id=eq.${booking.provider_id}` },
        (payload) => {
          const { lat, lng } = payload.new;
          if (lat && lng) setProviderLocation({ lat, lng });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  function subscribeToBookingStatus() {
    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          setBooking((prev: any) => ({ ...prev, ...payload.new }));
          if (payload.new.status === "arrived") {
            Alert.alert("Provider Arrived!", `${provider?.name} has arrived at your location.`);
          }
          if (payload.new.status === "completed") {
            Alert.alert("Visit Complete", "Your visit has been completed. Please rate your provider.");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  const patientRegion = booking
    ? { latitude: booking.patient_lat, longitude: booking.patient_lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : null;

  return (
    <View style={styles.container}>
      {patientRegion && (
        <MapView ref={mapRef} style={styles.map} initialRegion={patientRegion}>
          <Marker coordinate={{ latitude: booking.patient_lat, longitude: booking.patient_lng }}>
            <View style={styles.patientPin}>
              <Text style={{ fontSize: 20 }}>🏠</Text>
            </View>
          </Marker>

          {providerLocation && (
            <Marker coordinate={{ latitude: providerLocation.lat, longitude: providerLocation.lng }}>
              <View style={styles.providerPin}>
                <Text style={{ fontSize: 20 }}>👨‍⚕️</Text>
              </View>
            </Marker>
          )}
        </MapView>
      )}

      <View style={styles.panel}>
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>
            {(BOOKING_STATUS_LABELS as Record<string, string>)[booking?.status ?? "pending"]}
          </Text>
        </View>

        {provider && (
          <View style={styles.providerRow}>
            <View style={styles.providerAvatar}>
              <Text style={{ fontSize: 22, color: "#fff", fontWeight: "bold" }}>
                {provider.name[0]}
              </Text>
            </View>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={styles.providerSpec}>{provider.specialty}</Text>
              {provider.rating > 0 && (
                <Text style={styles.providerRating}>⭐ {provider.rating}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${provider.phone}`)}
            >
              <Text style={{ fontSize: 22 }}>📞</Text>
            </TouchableOpacity>
          </View>
        )}

        {booking?.status === "completed" && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => router.push({
              pathname: "/booking/rate",
              params: { bookingId, providerId: booking.provider_id },
            })}
          >
            <Text style={styles.rateBtnText}>Rate your visit →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  statusBanner: {
    backgroundColor: "#EFF6FF", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginBottom: 16
  },
  statusText: { fontSize: 15, fontWeight: "600", color: "#1E6FD9" },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  providerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#1E6FD9", alignItems: "center", justifyContent: "center"
  },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  providerSpec: { fontSize: 13, color: "#6B7280" },
  providerRating: { fontSize: 12, color: "#374151", marginTop: 2 },
  callBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center"
  },
  patientPin: {
    backgroundColor: "#fff", borderRadius: 20, padding: 4,
    borderWidth: 2, borderColor: "#1E6FD9"
  },
  providerPin: {
    backgroundColor: "#fff", borderRadius: 20, padding: 4,
    borderWidth: 2, borderColor: "#00B5A3"
  },
  rateBtn: {
    marginTop: 16, backgroundColor: "#0D2B5E", borderRadius: 10,
    paddingVertical: 14, alignItems: "center"
  },
  rateBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
