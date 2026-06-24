import { useEffect, useRef, useState } from "react";
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { SERVICE_LABELS, formatNaira } from "@streetdocmd/shared";

export default function DispatchScreen() {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadProvider();
    return () => { if (locationInterval.current) clearInterval(locationInterval.current); };
  }, []);

  async function loadProvider() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setProvider(data);
    if (data) {
      setAvailable(data.available);
      checkForActiveBooking(data.id);
      subscribeToDispatch(data.id);
    }
  }

  async function checkForActiveBooking(providerId: string) {
    const { data } = await supabase
      .from("bookings")
      .select("*, users!patient_id(name, phone, address, known_conditions, allergies, current_medications)")
      .eq("provider_id", providerId)
      .in("status", ["accepted", "en_route", "arrived", "in_progress"])
      .single();

    if (data) setActiveBooking(data);
  }

  function subscribeToDispatch(providerId: string) {
    supabase
      .channel(`dispatch-${providerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `provider_id=eq.${providerId}` },
        (payload) => {
          if (["accepted", "en_route", "arrived", "in_progress"].includes(payload.new.status)) {
            checkForActiveBooking(providerId);
          } else if (payload.new.status === "completed" || payload.new.status === "cancelled") {
            setActiveBooking(null);
          }
        }
      )
      .subscribe();

    // Listen for new dispatch offers via dispatch_queue
    supabase
      .channel(`dispatch-queue-${providerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dispatch_queue", filter: `provider_id=eq.${providerId}` },
        (payload) => { showBookingRequest(payload.new); }
      )
      .subscribe();
  }

  async function showBookingRequest(dispatch: any) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, users!patient_id(name)")
      .eq("id", dispatch.booking_id)
      .single();

    if (!booking) return;

    const expiresIn = Math.round(
      (new Date(dispatch.expires_at).getTime() - Date.now()) / 1000
    );

    Alert.alert(
      "New Booking Request",
      `Service: ${SERVICE_LABELS[booking.service_type as keyof typeof SERVICE_LABELS]}\nPatient: ${booking.users?.name}\nFee: ${formatNaira(booking.net_payout)} (your payout)\n\nYou have ${expiresIn} seconds to accept.`,
      [
        {
          text: "Decline",
          style: "destructive",
          onPress: () => respondToDispatch(dispatch.id, booking.id, "declined"),
        },
        {
          text: "Accept",
          onPress: () => respondToDispatch(dispatch.id, booking.id, "accepted"),
        },
      ]
    );
  }

  async function respondToDispatch(dispatchId: string, bookingId: string, response: "accepted" | "declined") {
    await supabase
      .from("dispatch_queue")
      .update({ response, responded_at: new Date().toISOString() })
      .eq("id", dispatchId);

    if (response === "accepted") {
      await supabase
        .from("bookings")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", bookingId);

      startLocationTracking();
      checkForActiveBooking(provider.id);
    }
  }

  async function toggleAvailability(value: boolean) {
    setAvailable(value);
    await supabase.from("providers").update({ available: value }).eq("id", provider.id);

    if (value) {
      startLocationTracking();
    } else {
      if (locationInterval.current) clearInterval(locationInterval.current);
    }
  }

  function startLocationTracking() {
    if (locationInterval.current) clearInterval(locationInterval.current);
    locationInterval.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({});
      await supabase
        .from("providers")
        .update({ lat: loc.coords.latitude, lng: loc.coords.longitude })
        .eq("id", provider.id);
    }, 10000); // every 10 seconds
  }

  async function updateBookingStatus(bookingId: string, status: string, field: string) {
    await supabase
      .from("bookings")
      .update({ status, [field]: new Date().toISOString() })
      .eq("id", bookingId);

    setActiveBooking((prev: any) => prev ? { ...prev, status } : null);

    if (status === "completed") {
      setActiveBooking(null);
      if (locationInterval.current) clearInterval(locationInterval.current);
    }
  }

  return (
    <View style={styles.container}>
      {/* Availability Toggle */}
      <View style={styles.toggleCard}>
        <View>
          <Text style={styles.toggleLabel}>
            {available ? "You are Available" : "You are Unavailable"}
          </Text>
          <Text style={styles.toggleSub}>
            {available ? "Receiving booking requests" : "Not receiving requests"}
          </Text>
        </View>
        <Switch
          value={available}
          onValueChange={toggleAvailability}
          trackColor={{ false: "#D1D5DB", true: "#6EE7B7" }}
          thumbColor={available ? "#059669" : "#9CA3AF"}
        />
      </View>

      {!provider?.badge_issued && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Your profile is pending verification. You'll receive bookings once approved.
          </Text>
        </View>
      )}

      {/* Active Booking */}
      {activeBooking ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Active Visit</Text>
          <Text style={styles.activeService}>
            {SERVICE_LABELS[activeBooking.service_type as keyof typeof SERVICE_LABELS]}
          </Text>
          <Text style={styles.activePatient}>
            Patient: {activeBooking.users?.name}
          </Text>
          <Text style={styles.activeAddress}>📍 {activeBooking.patient_address}</Text>

          <View style={styles.actionRow}>
            {activeBooking.status === "accepted" && (
              <ActionBtn
                label="Mark En Route"
                color="#7C3AED"
                onPress={() => updateBookingStatus(activeBooking.id, "en_route", "accepted_at")}
              />
            )}
            {activeBooking.status === "en_route" && (
              <ActionBtn
                label="Mark Arrived"
                color="#B45309"
                onPress={() => updateBookingStatus(activeBooking.id, "arrived", "arrived_at")}
              />
            )}
            {activeBooking.status === "arrived" && (
              <ActionBtn
                label="Start Visit"
                color="#0369A1"
                onPress={() => updateBookingStatus(activeBooking.id, "in_progress", "arrived_at")}
              />
            )}
            {activeBooking.status === "in_progress" && (
              <ActionBtn
                label="Complete Visit →"
                color="#059669"
                onPress={() => router.push({ pathname: "/visit/notes", params: { bookingId: activeBooking.id } })}
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>📡</Text>
          <Text style={styles.waitingTitle}>
            {available ? "Waiting for requests…" : "Toggle available to receive bookings"}
          </Text>
          <Text style={styles.waitingSubtext}>
            {available ? "You'll get an alert when a patient books nearby." : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16, gap: 12 },
  toggleCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB"
  },
  toggleLabel: { fontSize: 17, fontWeight: "700", color: "#111827" },
  toggleSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  warningCard: {
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#FDE68A"
  },
  warningText: { fontSize: 13, color: "#92400E", lineHeight: 20 },
  activeCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 20,
    borderWidth: 2, borderColor: "#059669"
  },
  activeTitle: { fontSize: 12, color: "#059669", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  activeService: { fontSize: 18, fontWeight: "700", color: "#111827" },
  activePatient: { fontSize: 14, color: "#374151", marginTop: 6 },
  activeAddress: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  actionRow: { marginTop: 16, gap: 10 },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  waitingCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  waitingEmoji: { fontSize: 48, marginBottom: 16 },
  waitingTitle: { fontSize: 17, fontWeight: "600", color: "#374151", textAlign: "center" },
  waitingSubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
});
