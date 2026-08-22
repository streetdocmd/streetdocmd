import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { formatNaira } from "@streetdocmd/shared";

interface CatalogueItem {
  id: string;
  test_name: string;
  test_code: string | null;
  price: number;
  turnaround_hours: number | null;
  sample_type: string | null;
}

interface SelectedTest {
  catalogue_id: string;
  test_name: string;
  test_code: string | null;
  price: number;
}

export default function LabInvestigationsCustomScreen() {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [labPartnerId, setLabPartnerId] = useState<string | null>(null);
  const [labName, setLabName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: lab } = await supabase
      .from("lab_partners")
      .select("id, name")
      .eq("active", true)
      .limit(1)
      .single();

    if (!lab) { setLoading(false); return; }
    setLabPartnerId(lab.id);
    setLabName(lab.name);

    const { data: tests } = await supabase
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, turnaround_hours, sample_type")
      .eq("lab_partner_id", lab.id)
      .eq("active", true)
      .order("test_name");

    setCatalogue(tests ?? []);
    setLoading(false);
  }

  function toggleTest(item: CatalogueItem) {
    setSelected(prev => {
      const exists = prev.find(t => t.catalogue_id === item.id);
      if (exists) return prev.filter(t => t.catalogue_id !== item.id);
      return [...prev, { catalogue_id: item.id, test_name: item.test_name, test_code: item.test_code, price: item.price }];
    });
  }

  const filtered = catalogue.filter(t =>
    t.test_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.test_code ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const total = selected.reduce((sum, t) => sum + t.price, 0);

  async function submit() {
    if (!labPartnerId || selected.length === 0) {
      Alert.alert("Select at least one test");
      return;
    }
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { error } = await supabase.from("investigation_orders").insert({
      patient_id: user.id,
      provider_id: null,
      lab_partner_id: labPartnerId,
      tests: selected,
      clinical_notes: notes.trim() || null,
      status: "ordered",
      requested_by: "patient",
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Error", "Could not place order. Please try again.");
      return;
    }

    Alert.alert(
      "Request Sent",
      `${selected.length} test(s) requested from ${labName}. Track progress in the Investigations tab.`,
      [{ text: "Done", onPress: () => router.replace("/(tabs)/investigations") }]
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>;
  }

  if (!labPartnerId) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>No lab partner available</Text>
        <Text style={s.emptyText}>Please check back shortly.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.partnerLabel}>Lab: {labName}</Text>

        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tests…"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {filtered.map(item => {
          const isSelected = !!selected.find(t => t.catalogue_id === item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.testRow, isSelected && s.testRowSelected]}
              onPress={() => toggleTest(item)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.testName, isSelected && { color: "#1E6FD9" }]}>{item.test_name}</Text>
                <Text style={s.testMeta}>
                  {item.test_code ? `${item.test_code} · ` : ""}{item.sample_type ?? "Blood"} · {item.turnaround_hours ?? "—"}h TAT
                </Text>
              </View>
              <Text style={s.testPrice}>{formatNaira(item.price)}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={s.sectionLabel}>Reason for investigation (optional)</Text>
        <TextInput
          style={s.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Follow-up on symptoms, routine screening…"
          placeholderTextColor="#9CA3AF"
          multiline
        />
      </ScrollView>

      {selected.length > 0 && (
        <View style={s.footer}>
          <View style={{ flex: 1 }}>
            <Text style={s.footerCount}>{selected.length} test(s) selected</Text>
            <Text style={s.footerTotal}>Total: {formatNaira(total)}</Text>
          </View>
          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.5 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Request Tests</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 120 },
  partnerLabel: { fontSize: 13, color: "#1E6FD9", fontWeight: "600", marginBottom: 12 },
  searchBox: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { fontSize: 14, color: "#111827", paddingVertical: 12 },
  testRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff",
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, marginBottom: 8,
  },
  testRowSelected: { borderColor: "#1E6FD9", backgroundColor: "#EFF6FF" },
  testName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  testMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  testPrice: { fontSize: 13, fontWeight: "600", color: "#374151" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 16, marginBottom: 8 },
  notesInput: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    padding: 12, fontSize: 14, color: "#111827", minHeight: 80,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#E5E7EB", padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  footerCount: { fontSize: 13, color: "#6B7280" },
  footerTotal: { fontSize: 16, fontWeight: "700", color: "#111827" },
  submitBtn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
