import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ClinicalNotesScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    chief_complaint: "",
    history: "",
    examination_findings: "",
    diagnosis: "",
    treatment: "",
    follow_up_plan: "",
  });
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveNotes() {
    if (!form.diagnosis || !form.treatment) {
      Alert.alert("Required fields", "Please enter at least a diagnosis and treatment plan.");
      return;
    }

    setSaving(true);

    // Get patient_id from booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("patient_id")
      .eq("id", bookingId)
      .single();

    // Create visit record
    const { data: visit, error } = await supabase
      .from("visits")
      .insert({ booking_id: bookingId, ...form })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      Alert.alert("Error", "Could not save notes. Please try again.");
      return;
    }

    router.replace({
      pathname: "/visit/post-consultation",
      params: { bookingId, visitId: visit.id, patientId: booking?.patient_id ?? "" },
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Clinical Notes</Text>
      <Text style={styles.pageSubtitle}>SOAP format — fill what is clinically relevant</Text>

      <Field
        label="Chief Complaint"
        value={form.chief_complaint}
        onChange={(v) => update("chief_complaint", v)}
        placeholder="Patient's presenting complaint"
      />
      <Field
        label="History"
        value={form.history}
        onChange={(v) => update("history", v)}
        placeholder="History of presenting illness, relevant past history"
        multiline
      />
      <Field
        label="Examination Findings"
        value={form.examination_findings}
        onChange={(v) => update("examination_findings", v)}
        placeholder="Vital signs, physical examination findings"
        multiline
      />
      <Field
        label="Diagnosis *"
        value={form.diagnosis}
        onChange={(v) => update("diagnosis", v)}
        placeholder="Primary and secondary diagnoses"
        multiline
        required
      />
      <Field
        label="Treatment *"
        value={form.treatment}
        onChange={(v) => update("treatment", v)}
        placeholder="Treatment given, medications administered"
        multiline
        required
      />
      <Field
        label="Follow-up Plan"
        value={form.follow_up_plan}
        onChange={(v) => update("follow_up_plan", v)}
        placeholder="Instructions for patient, when to return or escalate"
        multiline
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={saveNotes}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save & Continue →</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, required
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; multiline?: boolean; required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required && <Text style={{ color: "#EF4444" }}> *</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16 },
  pageTitle: { fontSize: 20, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: "#6B7280", marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#111827",
  },
  inputMulti: { minHeight: 90 },
  saveBtn: {
    backgroundColor: "#059669", borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8, marginBottom: 32
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
