import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";

const SUGGESTIONS = [
  "I need a doctor to check my fever and cough",
  "Diabetic patient needs insulin management",
  "Post-surgery wound monitoring",
  "Elderly parent needs general assessment",
  "IV drip / infusion at home",
  "Antenatal check-up at home",
];

export default function CustomRequestScreen() {
  const router = useRouter();
  const [description, setDescription] = useState("");

  function proceed() {
    if (description.trim().length < 10) {
      Alert.alert("Describe your need", "Please provide at least a brief description so we can send the right provider.");
      return;
    }
    router.push({
      pathname: "/booking/confirm",
      params: { service: "custom_request", description: description.trim() },
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>What do you need?</Text>
        <Text style={s.sub}>Describe your medical need so we can match you with the right provider.</Text>

        <TextInput
          style={s.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. I have a persistent fever and need a doctor to come assess me at home..."
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={s.charCount}>{description.length}/500</Text>

        <Text style={s.suggestTitle}>Common requests</Text>
        {SUGGESTIONS.map((s_) => (
          <TouchableOpacity
            key={s_}
            style={s.suggestionChip}
            onPress={() => setDescription(s_)}
            activeOpacity={0.7}
          >
            <Text style={s.suggestionText}>{s_}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[s.btn, description.trim().length < 10 && s.btnDisabled]}
          onPress={proceed}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Find a Provider →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 6 },
  sub: { fontSize: 13, color: "#6B7280", lineHeight: 19, marginBottom: 20 },
  textarea: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, padding: 14, fontSize: 14, color: "#111827",
    minHeight: 120, marginBottom: 4,
  },
  charCount: { fontSize: 11, color: "#9CA3AF", textAlign: "right", marginBottom: 20 },
  suggestTitle: { fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  suggestionChip: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 8,
  },
  suggestionText: { fontSize: 13, color: "#374151" },
  btn: {
    backgroundColor: "#0D2B5E", borderRadius: 12,
    paddingVertical: 16, alignItems: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});