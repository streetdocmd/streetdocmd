import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import FamilyMemberPicker from "../../components/FamilyMemberPicker";
import { formatNaira, SERVICE_PROFESSION } from "@streetdocmd/shared";

interface WellnessPackage {
  id: string;
  name: string;
  price: number;
  description: string | null;
  included_tests: { test_name: string }[];
}

type GeoState = "idle" | "locating" | "ready" | "denied";

export default function WellnessPackagesScreen() {
  const router = useRouter();
  const [packages, setPackages] = useState<WellnessPackage[]>([]);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    supabase
      .from("wellness_packages")
      .select("id, name, price, description, included_tests")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        setPackages(data ?? []);
        setPackageId(data?.[0]?.id ?? null);
        setLoading(false);
      });
  }, []);

  const selectedPackage = packages.find(p => p.id === packageId) ?? null;

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

  async function bookNow() {
    if (!coords || !packageId) return;
    setBooking(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBooking(false); return; }

    // Wellness Check still books through the same bookings table every
    // other service uses — dispatch/payment are unchanged, only the fee
    // and tests snapshot now come from the chosen tier.
    const commission = Math.round(selectedPackage!.price * 0.2);
    const { data: newBooking, error } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        family_member_id: familyMemberId,
        service_type: "wellness_check",
        wellness_package_id: packageId,
        profession: SERVICE_PROFESSION.wellness_check,
        patient_lat: coords.lat,
        patient_lng: coords.lng,
        patient_address: address,
        fee: selectedPackage!.price,
        commission,
        net_payout: selectedPackage!.price - commission,
        status: "pending_payment",
        payment_status: "pending",
      })
      .select("id")
      .single();

    setBooking(false);
    if (error || !newBooking) {
      Alert.alert("Error", "Could not create booking. Please try again.");
      return;
    }
    router.push({ pathname: "/booking/payment", params: { bookingId: newBooking.id } });
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={s.content}>
        <Text style={s.title}>Wellness Check</Text>
        <Text style={s.subtitle}>Choose a package — a provider will be dispatched to collect your samples</Text>

        {packages.map(pkg => {
          const isSelected = packageId === pkg.id;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[s.card, isSelected && s.cardSelected]}
              onPress={() => setPackageId(pkg.id)}
              activeOpacity={0.8}
            >
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{pkg.name}</Text>
                <Text style={s.cardPrice}>{formatNaira(pkg.price)}</Text>
              </View>
              {pkg.description && <Text style={s.cardDesc}>{pkg.description}</Text>}
              <Text style={s.cardTests}>{pkg.included_tests.map(t => t.test_name).join(" · ")}</Text>
            </TouchableOpacity>
          );
        })}
        {packages.length === 0 && (
          <Text style={s.subtitle}>No wellness packages available right now.</Text>
        )}

        {selectedPackage && (
          <>
            <FamilyMemberPicker onChange={setFamilyMemberId} />

            {geoState === "idle" && (
              <View style={s.locationCard}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
                <Text style={s.cardTitle}>Share your location</Text>
                <Text style={s.cardDesc}>We use your location to find the nearest available provider.</Text>
                <TouchableOpacity style={s.btn} onPress={getLocation}>
                  <Text style={s.btnText}>Allow location access</Text>
                </TouchableOpacity>
              </View>
            )}

            {geoState === "locating" && (
              <View style={s.locationCard}>
                <ActivityIndicator size="large" color="#1E6FD9" />
              </View>
            )}

            {geoState === "denied" && (
              <View style={[s.locationCard, { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }]}>
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
                  style={[s.bookBtn, booking && { opacity: 0.6 }]}
                  onPress={bookNow}
                  disabled={booking}
                >
                  {booking ? <ActivityIndicator color="#fff" /> : (
                    <Text style={s.bookBtnText}>Book Now · {formatNaira(selectedPackage.price)}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", padding: 16,
  },
  cardSelected: { borderColor: "#1E6FD9", backgroundColor: "#EFF6FF" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardPrice: { fontSize: 15, fontWeight: "700", color: "#1E6FD9" },
  cardDesc: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  cardTests: { fontSize: 12, color: "#9CA3AF", marginTop: 8 },
  locationCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  btn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 12 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  addressCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  addressText: { fontSize: 13, color: "#374151", flex: 1 },
  bookBtn: { backgroundColor: "#1E6FD9", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  bookBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
