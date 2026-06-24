import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function RateScreen() {
  const { bookingId, providerId } = useLocalSearchParams<{ bookingId: string; providerId: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (rating === 0) { Alert.alert("Select a rating", "Please tap a star to rate your visit."); return; }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      provider_id: providerId,
      patient_id: user.id,
      rating,
      comment: comment.trim() || null,
    });

    setSubmitting(false);
    if (error) { Alert.alert("Error", "Could not submit rating. Please try again."); return; }
    Alert.alert("Thank you!", "Your feedback helps us maintain quality care.", [
      { text: "Done", onPress: () => router.replace("/(tabs)/bookings") }
    ]);
  }

  const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.title}>How was your visit?</Text>
        <Text style={s.sub}>Your feedback helps us improve care quality.</Text>

        <View style={s.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
              <Text style={[s.star, n <= rating && s.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>

        {rating > 0 && (
          <Text style={s.ratingLabel}>{LABELS[rating]}</Text>
        )}

        <TextInput
          style={s.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Tell us more (optional)..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[s.btn, (submitting || rating === 0) && s.btnDisabled]}
          onPress={submit}
          disabled={submitting || rating === 0}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Submit Rating</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(tabs)/bookings")} style={s.skip}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D2B5E", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 6 },
  sub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  stars: { flexDirection: "row", gap: 8, marginBottom: 8 },
  star: { fontSize: 44, color: "#D1D5DB" },
  starActive: { color: "#F59E0B" },
  ratingLabel: { fontSize: 15, fontWeight: "600", color: "#1E6FD9", marginBottom: 16 },
  input: {
    width: "100%", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#374151",
    minHeight: 90, marginBottom: 20,
  },
  btn: { width: "100%", backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skip: { marginTop: 14 },
  skipText: { color: "#9CA3AF", fontSize: 13 },
});