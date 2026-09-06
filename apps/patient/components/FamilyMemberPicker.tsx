import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "../lib/supabase";

type FamilyMember = { id: string; name: string; relationship: string };

export default function FamilyMemberPicker({
  onChange,
}: {
  onChange: (familyMemberId: string | null) => void;
}) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("family_members")
      .select("id, name, relationship")
      .order("created_at", { ascending: true })
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  function select(id: string | null) {
    setSelected(id);
    onChange(id);
  }

  async function addMember() {
    if (!name.trim() || !relationship.trim()) return;
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("family_members")
      .insert({ account_holder_id: user!.id, name: name.trim(), relationship: relationship.trim() })
      .select("id, name, relationship")
      .single();
    setSaving(false);
    if (error || !data) { setError(error?.message ?? "Could not add family member"); return; }
    setMembers(prev => [...prev, data]);
    select(data.id);
    setAdding(false);
    setName("");
    setRelationship("");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Who is this visit for?</Text>

      <TouchableOpacity style={[styles.option, selected === null && styles.optionSelected]} onPress={() => select(null)}>
        <View style={[styles.radio, selected === null && styles.radioSelected]} />
        <Text style={styles.optionText}>Myself</Text>
      </TouchableOpacity>

      {members.map(m => (
        <TouchableOpacity
          key={m.id}
          style={[styles.option, selected === m.id && styles.optionSelected]}
          onPress={() => select(m.id)}
        >
          <View style={[styles.radio, selected === m.id && styles.radioSelected]} />
          <Text style={styles.optionText}>{m.name}</Text>
          <Text style={styles.optionSub}> · {m.relationship}</Text>
        </TouchableOpacity>
      ))}

      {!adding ? (
        <TouchableOpacity onPress={() => setAdding(true)} style={{ marginTop: 4 }}>
          <Text style={styles.addLink}>+ Add someone else</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addForm}>
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Adaeze Okafor" />
          <Text style={styles.label}>Relationship</Text>
          <TextInput style={styles.input} value={relationship} onChangeText={setRelationship} placeholder="e.g. Mother, Son, Spouse" />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <TouchableOpacity style={styles.saveBtn} onPress={addMember} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setAdding(false); setError(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB", gap: 8,
  },
  title: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 4 },
  option: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12,
  },
  optionSelected: { borderColor: "#1E6FD9", backgroundColor: "#EFF6FF" },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#D1D5DB" },
  radioSelected: { borderColor: "#1E6FD9", backgroundColor: "#1E6FD9" },
  optionText: { fontSize: 14, fontWeight: "500", color: "#111827" },
  optionSub: { fontSize: 12, color: "#9CA3AF" },
  addLink: { fontSize: 13, color: "#1E6FD9", fontWeight: "600" },
  addForm: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, gap: 6 },
  label: { fontSize: 13, color: "#444", fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  error: { color: "#DC2626", fontSize: 12 },
  saveBtn: { backgroundColor: "#1E6FD9", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  cancelText: { color: "#6B7280", fontSize: 13, alignSelf: "center" },
});
