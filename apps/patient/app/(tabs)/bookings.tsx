import { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatNaira, SERVICE_LABELS, BOOKING_STATUS_LABELS } from "@streetdocmd/shared";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "#FFEDD5",
  provider_declined: "#FEE2E2",
  pending: "#FEF3C7",
  accepted: "#DBEAFE",
  en_route: "#EDE9FE",
  arrived: "#E0E7FF",
  in_progress: "#FEF3C7",
  completed: "#D1FAE5",
  cancelled: "#FEE2E2",
};
const STATUS_TEXT: Record<string, string> = {
  pending_payment: "#9A3412",
  provider_declined: "#991B1B",
  pending: "#92400E", accepted: "#1E40AF", en_route: "#5B21B6",
  arrived: "#3730A3", in_progress: "#92400E", completed: "#065F46", cancelled: "#991B1B",
};

const ACTIVE_STATUSES = ["accepted", "en_route", "arrived", "in_progress"];

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [])
  );

  async function loadBookings(silent = false) {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookings")
      .select("*, providers!bookings_provider_id_fkey(name, specialty), reviews(id), family_members(name, relationship)")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });

    setBookings(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  async function cancelBooking(bookingId: string) {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("bookings")
              .update({ status: "cancelled" })
              .eq("id", bookingId)
              .eq("status", "pending");
            if (error) Alert.alert("Error", "Could not cancel. Please try again.");
            else loadBookings(true);
          },
        },
      ]
    );
  }

  async function searchNearest(bookingId: string) {
    const { error } = await supabase.rpc("retry_dispatch_broad", { p_booking_id: bookingId });
    if (error) Alert.alert("Error", error.message);
    else loadBookings(true);
  }

  function handleTap(b: any) {
    if (ACTIVE_STATUSES.includes(b.status)) {
      router.push({ pathname: "/booking/tracking", params: { bookingId: b.id } });
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={(b) => b.id}
      contentContainerStyle={bookings.length === 0 ? styles.center : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadBookings(true); }}
          tintColor="#1E6FD9"
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>Your booking history will appear here.</Text>
        </View>
      }
      renderItem={({ item: b }) => {
        const isActive = ACTIVE_STATUSES.includes(b.status);
        const isRated = (b.reviews?.length ?? 0) > 0;

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleTap(b)}
            activeOpacity={isActive ? 0.75 : 1}
          >
            <View style={styles.cardTop}>
              <Text style={styles.serviceName}>{SERVICE_LABELS[b.service_type]}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[b.status] }]}>
                <Text style={[styles.badgeText, { color: STATUS_TEXT[b.status] }]}>
                  {(BOOKING_STATUS_LABELS as Record<string, string>)[b.status]}
                </Text>
              </View>
            </View>

            {b.providers && (
              <Text style={styles.provider}>{b.providers.name} · {b.providers.specialty}</Text>
            )}
            {b.family_members && (
              <Text style={styles.provider}>For {b.family_members.name} ({b.family_members.relationship})</Text>
            )}
            {b.follow_up_of_booking_id && (
              <Text style={styles.followUpNote}>Recommended by your provider as a follow-up visit</Text>
            )}
            {b.status === "provider_declined" && (
              <Text style={styles.declinedNote}>The provider you requested wasn't able to accept this booking.</Text>
            )}

            <View style={styles.cardBottom}>
              <Text style={styles.fee}>{formatNaira(b.fee)}</Text>
              <Text style={styles.date}>
                {new Date(b.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>

            {b.status === "pending_payment" && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => router.push({ pathname: "/booking/payment", params: { bookingId: b.id } })}
                >
                  <Text style={styles.payBtnText}>Pay Now →</Text>
                </TouchableOpacity>
              </View>
            )}

            {isActive && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() => router.push({ pathname: "/booking/tracking", params: { bookingId: b.id } })}
                >
                  <Text style={styles.trackBtnText}>Track Provider →</Text>
                </TouchableOpacity>
              </View>
            )}

            {b.status === "pending" && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelBooking(b.id)}>
                  <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                </TouchableOpacity>
              </View>
            )}

            {b.status === "completed" && !isRated && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.rateBtn}
                  onPress={() => router.push({
                    pathname: "/booking/rate",
                    params: { bookingId: b.id, providerId: b.provider_id },
                  })}
                >
                  <Text style={styles.rateBtnText}>Rate your visit ★</Text>
                </TouchableOpacity>
              </View>
            )}

            {b.status === "completed" && isRated && (
              <Text style={styles.ratedTag}>✓ Rated</Text>
            )}

            {b.status === "provider_declined" && (
              <View style={styles.declinedActions}>
                <TouchableOpacity
                  style={styles.chooseAnotherBtn}
                  onPress={() => router.push({ pathname: "/booking/preferred-provider", params: { retarget: b.id } })}
                >
                  <Text style={styles.chooseAnotherBtnText}>Choose another provider</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.searchNearestBtn} onPress={() => searchNearest(b.id)}>
                  <Text style={styles.searchNearestBtnText}>Search nearest available</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  serviceName: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  provider: { fontSize: 13, color: "#6B7280", marginBottom: 10 },
  followUpNote: { fontSize: 12, color: "#1E6FD9", marginBottom: 10, marginTop: -6 },
  declinedNote: { fontSize: 12, color: "#DC2626", marginBottom: 10, marginTop: -6 },
  declinedActions: { marginTop: 10, gap: 8 },
  chooseAnotherBtn: { backgroundColor: "#1E6FD9", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  chooseAnotherBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  searchNearestBtn: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  searchNearestBtnText: { color: "#6B7280", fontWeight: "600", fontSize: 13 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  fee: { fontSize: 14, fontWeight: "700", color: "#1E6FD9" },
  date: { fontSize: 12, color: "#9CA3AF" },
  actionRow: { marginTop: 10 },
  trackBtn: {
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 8, paddingVertical: 9, alignItems: "center",
  },
  trackBtnText: { color: "#1E6FD9", fontWeight: "600", fontSize: 13 },
  payBtn: { backgroundColor: "#1E6FD9", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  payBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  cancelBtn: {
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 8, paddingVertical: 9, alignItems: "center",
  },
  cancelBtnText: { color: "#DC2626", fontWeight: "600", fontSize: 13 },
  rateBtn: {
    backgroundColor: "#0D2B5E", borderRadius: 8,
    paddingVertical: 9, alignItems: "center",
  },
  rateBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  ratedTag: { marginTop: 8, fontSize: 12, color: "#059669", fontWeight: "500" },
});