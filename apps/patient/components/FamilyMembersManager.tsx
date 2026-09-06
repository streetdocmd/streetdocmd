import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { supabase } from "../lib/supabase";

interface FamilyMember { id: string; name: string; relationship: string }

export default function FamilyMembersManager({
  initialMembers,
}: {
  initialMembers: FamilyMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);

  function confirmRemove(member: FamilyMember) {
    Alert.alert(
      "Remove family member",
      `Remove ${member.name}? Past bookings made for them will be kept, just no longer linked to them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            setRemovingId(member.id);
            const { error } = await supabase.from("family_members").delete().eq("id", member.id);
            setRemovingId(null);
            if (error) { Alert.alert("Error", "Could not remove. Please try again."); return; }
            setMembers(prev => prev.filter(m => m.id !== member.id));
          },
        },
      ]
    );
  }

  async function addMember() {
    if (!name.trim() || !relationship.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("family_members")
      .insert({ account_holder_id: user!.id, name: name.trim(), relationship: relationship.trim() })
      .select("id, name, relationship")
      .single();
    setSaving(false);
    if (error || !data) { Alert.alert("Error", "Could not add family member."); return; }
    setMembers(prev => [...prev, data]);
    setAdding(false);
    setName("");
    setRelationship("");
  }

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Family Members</Text>

      {members.length === 0 && !adding && (
        <Text style={s.emptyText}>You haven't added anyone yet.</Text>
      )}

      {members.map(m => (
        <View key={m.id} style={s.row}>
          <View>
            <Text style={s.rowName}>{m.name}</Text>
            <Text style={s.rowRelationship}>{m.relationship}</Text>
          </View>
          <TouchableOpacity onPress={() => confirmRemove(m)} disabled={removingId === m.id}>
            <Text style={s.removeText}>{removingId === m.id ? "Removing…" : "Remove"}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {!adding ? (
        <TouchableOpacity onPress={() => setAdding(true)} style={{ marginTop: 8 }}>
          <Text style={s.addLink}>+ Add family member</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.addForm}>
          <Text style={s.label}>Full name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Adaeze Okafor" />
          <Text style={s.label}>Relationship</Text>
          <TextInput style={s.input} value={relationship} onChangeText={setRelationship} placeholder="e.g. Mother, Son, Spouse" />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <TouchableOpacity style={s.saveBtn} onPress={addMember} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  emptyText: { fontSize: 13, color: "#9CA3AF" },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB",
  },
  rowName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  rowRelationship: { fontSize: 12, color: "#9CA3AF" },
  removeText: { fontSize: 13, color: "#DC2626", fontWeight: "500" },
  addLink: { fontSize: 13, color: "#1E6FD9", fontWeight: "600" },
  addForm: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, marginTop: 10, gap: 6 },
  label: { fontSize: 13, color: "#444", fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  saveBtn: { backgroundColor: "#1E6FD9", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  cancelText: { color: "#6B7280", fontSize: 13, alignSelf: "center" },
});
