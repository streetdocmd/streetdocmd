"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, Chip, Input } from "@/components/ds";

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
    const supabase = createClient();
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

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !relationship.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
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
    <section>
      <h3 className="mb-3 text-[17px] font-bold text-navy">Who is this for?</h3>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Who is this for">
        <Chip selected={selected === null} onClick={() => select(null)}>Me</Chip>
        {members.map(m => (
          <Chip key={m.id} selected={selected === m.id} onClick={() => select(m.id)}>
            {m.name} <span className="font-semibold opacity-70">· {m.relationship}</span>
          </Chip>
        ))}
        {!adding && (
          <Chip onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden /> Someone else
          </Chip>
        )}
      </div>

      {adding && (
        <form onSubmit={addMember} className="mt-3 space-y-3 rounded-ds-lg border border-line bg-surface p-4">
          <Input label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adaeze Okafor" required />
          <Input label="Relationship" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Mother, Son, Spouse" required />
          {error && <p className="text-ds-xs font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
