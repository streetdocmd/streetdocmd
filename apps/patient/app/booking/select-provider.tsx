import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import {
  Provider, ServiceType, SERVICE_LABELS, SERVICE_PRICES, SERVICE_PROFESSION,
  formatNaira, getDistanceKm, getEtaMinutes
} from "@streetdocmd/shared";

type NearbyProvider = Provider & { distance_km: number; eta_minutes: number };

export default function SelectProviderScreen() {
  const { service, description } = useLocalSearchParams<{ service: ServiceType; description?: string }>();
  const router = useRouter();
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    const loc = await Location.getCurrentPositionAsync({});
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    setUserLat(lat);
    setUserLng(lng);

    const { data, error } = await supabase.rpc("get_nearby_providers", {
      booking_lat: lat,
      booking_lng: lng,
      radius_km: 15,
      p_profession: SERVICE_PROFESSION[service],
    });

    if (error || !data?.length) {
      setLoading(false);
      return;
    }

    const providerIds = data.map((d: { provider_id: string }) => d.provider_id);
    const { data: providerDetails } = await supabase
      .from("providers")
      .select("*")
      .in("id", providerIds);

    const enriched = (providerDetails ?? []).map((p) => {
      const match = data.find((d: { provider_id: string }) => d.provider_id === p.id);
      const dist = match?.distance_km ?? getDistanceKm(lat, lng, p.lat, p.lng);
      return { ...p, distance_km: dist, eta_minutes: getEtaMinutes(dist) };
    });

    enriched.sort((a, b) => a.distance_km - b.distance_km);
    setProviders(enriched);
    setLoading(false);
  }

  async function bookProvider(provider: NearbyProvider) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fee = SERVICE_PRICES[service];
    const commission = Math.round(fee * 0.2);

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        provider_id: provider.id,
        service_type: service,
        profession: SERVICE_PROFESSION[service],
        patient_lat: userLat,
        patient_lng: userLng,
        patient_address: "Current location",
        fee,
        commission,
        net_payout: fee - commission,
        status: "pending",
        payment_status: "pending",
        ...(description ? { notes: description } : {}),
      })
      .select()
      .single();

    if (error) {
      Alert.alert("Error", "Could not create booking. Please try again.");
      return;
    }

    // Notify provider via dispatch queue (2-minute acceptance window)
    await supabase.from("dispatch_queue").insert({
      booking_id: booking.id,
      provider_id: provider.id,
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });

    router.push({ pathname: "/booking/payment", params: { bookingId: booking.id } });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{SERVICE_LABELS[service]}</Text>
        <Text style={styles.price}>{formatNaira(SERVICE_PRICES[service])}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E6FD9" />
          <Text style={styles.loadingText}>Finding nearby providers…</Text>
        </View>
      ) : providers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No providers nearby</Text>
          <Text style={styles.emptySubtext}>
            There are no available providers in your area right now. Please try again shortly.
          </Text>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: p }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.name[0]}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.providerName}>{p.name}</Text>
                  <Text style={styles.specialty}>{p.specialty} · {p.credentials}</Text>
                  <View style={styles.meta}>
                    <Text style={styles.metaText}>⭐ {p.rating > 0 ? p.rating : "New"}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{p.distance_km.toFixed(1)} km away</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>~{p.eta_minutes} min</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.bookBtn} onPress={() => bookProvider(p)}>
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { color: "#6B7280", marginTop: 12, fontSize: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginTop: 8, lineHeight: 20 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#1E6FD9", alignItems: "center", justifyContent: "center"
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  info: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  specialty: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  metaText: { fontSize: 12, color: "#374151" },
  metaDot: { color: "#D1D5DB" },
  bookBtn: {
    backgroundColor: "#1E6FD9", borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10
  },
  bookBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
