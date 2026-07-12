import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

interface CatalogueItem {
  id: string;
  test_name: string;
  test_code: string;
  price: number;
  turnaround_hours: number;
  sample_type: string;
  home_collection: boolean;
}

interface SelectedTest {
  catalogue_id: string;
  test_name: string;
  test_code: string;
  price: number;
}

export default function OrderInvestigationsScreen() {
  const { bookingId, patientId, visitId, returnTo } = useLocalSearchParams<{
    bookingId: string;
    patientId: string;
    visitId: string;
    returnTo?: string;
  }>();
  const router = useRouter();

  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedTest[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [labPartnerId, setLabPartnerId] = useState<string | null>(null);
  const [labName, setLabName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCatalogue();
  }, []);

  async function loadCatalogue() {
    // Get first active lab partner (nearest-first logic can be added with lat/lng)
    const { data: lab } = await supabase
      .from("lab_partners")
      .select("id, name")
      .eq("active", true)
      .limit(1)
      .single();

    if (!lab) {
      setLoading(false);
      return;
    }

    setLabPartnerId(lab.id);
    setLabName(lab.name);

    const { data: tests } = await supabase
      .from("investigation_catalogue")
      .select("id, test_name, test_code, price, turnaround_hours, sample_type, home_collection")
      .eq("lab_partner_id", lab.id)
      .eq("active", true)
      .order("test_name");

    setCatalogue(tests ?? []);
    setLoading(false);
  }

  function toggleTest(item: CatalogueItem) {
    setSelected((prev) => {
      const exists = prev.find((t) => t.catalogue_id === item.id);
      if (exists) return prev.filter((t) => t.catalogue_id !== item.id);
      return [...prev, {
        catalogue_id: item.id,
        test_name: item.test_name,
        test_code: item.test_code,
        price: item.price,
      }];
    });
  }

  const filtered = catalogue.filter((t) =>
    t.test_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.test_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPrice = selected.reduce((sum, t) => sum + t.price, 0);

  async function submitOrder() {
    if (!labPartnerId || selected.length === 0) {
      Alert.alert("Select at least one test");
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!provider) { setSubmitting(false); return; }

    const { error } = await supabase.from("investigation_orders").insert({
      booking_id:    bookingId || null,
      patient_id:    patientId,
      provider_id:   provider.id,
      lab_partner_id: labPartnerId,
      tests:          selected,
      clinical_notes: clinicalNotes.trim() || null,
      status:         "ordered",
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Error", "Could not place order. Please try again.");
      return;
    }

    if (returnTo === "post-consultation") {
      router.replace({
        pathname: "/visit/post-consultation",
        params: { bookingId, visitId, patientId, fromLabs: "1" },
      });
    } else {
      Alert.alert(
        "Order Placed",
        `${selected.length} test(s) ordered from ${labName}. The lab will confirm shortly.`,
        [{ text: "Done", onPress: () => router.replace("/(tabs)/dispatch") }]
      );
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#059669" /></View>;
  }

  if (!labPartnerId) {
    return (
      <View style={s.center}>
        <Text style={s.emptyTitle}>No lab partner available</Text>
        <Text style={s.emptyText}>Contact admin to add a lab partner.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.partnerLabel}>Lab: {labName}</Text>

        {/* Search */}
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tests…"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Catalogue list */}
        {filtered.length === 0 ? (
          <Text style={s.emptyText}>No tests found</Text>
        ) : (
          filtered.map((item) => {
            const isSelected = !!selected.find((t) => t.catalogue_id === item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.testRow, isSelected && s.testRowSelected]}
                onPress={() => toggleTest(item)}
                activeOpacity={0.7}
              >
                <View style={s.testInfo}>
                  <Text style={[s.testName, isSelected && { color: "#059669" }]}>
                    {item.test_name}
                  </Text>
                  <Text style={s.testMeta}>
                    {item.test_code ? `${item.test_code} · ` : ""}
                    {item.sample_type ?? "Blood"} · {item.turnaround_hours ?? "—"}h TAT
                  </Text>
                </View>
                <View style={s.testRight}>
                  <Text style={s.testPrice}>₦{item.price.toLocaleString()}</Text>
                  <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                    {isSelected && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Clinical notes */}
        <Text style={s.sectionLabel}>Clinical Indication</Text>
        <TextInput
          style={s.notesInput}
          value={clinicalNotes}
          onChangeText={setClinicalNotes}
          placeholder="Reason for investigation, clinical history for lab…"
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Bottom summary + submit */}
      {selected.length > 0 && (
        <View style={s.footer}>
          <View style={s.footerInfo}>
            <Text style={s.footerCount}>{selected.length} test(s) selected</Text>
            <Text style={s.footerTotal}>Total: ₦{totalPrice.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.5 }]}
            onPress={submitOrder}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>Place Order</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 120 },
  partnerLabel: { fontSize: 13, color: "#059669", fontWeight: "600", marginBottom: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", paddingVertical: 12 },
  testRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    padding: 14, marginBottom: 8,
  },
  testRowSelected: { borderColor: "#059669", backgroundColor: "#F0FDF4" },
  testInfo: { flex: 1 },
  testName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  testMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  testRight: { alignItems: "flex-end", gap: 6 },
  testPrice: { fontSize: 13, fontWeight: "600", color: "#374151" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: "#059669", borderColor: "#059669" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 16, marginBottom: 8 },
  notesInput: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    padding: 12, fontSize: 14, color: "#111827", minHeight: 90,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB",
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  footerInfo: { flex: 1 },
  footerCount: { fontSize: 13, color: "#6B7280" },
  footerTotal: { fontSize: 16, fontWeight: "700", color: "#111827" },
  submitBtn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
