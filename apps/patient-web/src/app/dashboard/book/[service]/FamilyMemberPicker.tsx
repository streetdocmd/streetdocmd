"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, Chip, Input } from "@/components/ds";

type FamilyMember = { id: string; name: string; relationship: string; phone?: string | null };

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
  const [phone, setPhone] = useState("");
  // A member saved before phone numbers were asked for
  const [missingPhone, setMissingPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("family_members")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  function select(id: string | null) {
    setSelected(id);
    setMissingPhone("");
    setError("");
    onChange(id);
  }

  // The provider calls the person being seen, so they need a number
  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || missingPhone.replace(/\D/g, "").length < 10) { setError("Enter a valid phone number, e.g. 08012345678."); return; }
    setSaving(true);
    setError("");
    const { error } = await createClient().from("family_members").update({ phone: missingPhone.trim() }).eq("id", selected);
    setSaving(false);
    if (error) { setError("Couldn't save the phone number. Please try again."); return; }
    setMembers(prev => prev.map(m => m.id === selected ? { ...m, phone: missingPhone.trim() } : m));
    setMissingPhone("");
  }
  const current = members.find(m => m.id === selected);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !relationship.trim()) return;
    if (!(phone.replace(/\D/g, "").length >= 10)) { setError("Enter their phone number, e.g. 08012345678, so the provider can reach them."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("family_members")
      .insert({ account_holder_id: user!.id, name: name.trim(), relationship: relationship.trim(), phone: phone.trim() })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) { setError(error?.message ?? "Could not add family member"); return; }
    setMembers(prev => [...prev, data]);
    select(data.id);
    setAdding(false);
    setName("");
    setRelationship("");
    setPhone("");
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

      {current && !current.phone && !adding && (
        <form onSubmit={savePhone} className="mt-3 space-y-3 rounded-ds-lg border border-line bg-surface p-4">
          <Input label={`${current.name}'s phone number`} type="tel" inputMode="tel" value={missingPhone}
            onChange={e => setMissingPhone(e.target.value)} placeholder="08012345678" required
            hint="The provider calls this number to reach them for the visit." />
          {error && <p className="text-ds-xs font-semibold text-danger">{error}</p>}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save number"}</Button>
        </form>
      )}

      {adding && (
        <form onSubmit={addMember} className="mt-3 space-y-3 rounded-ds-lg border border-line bg-surface p-4">
          <Input label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adaeze Okafor" required />
          <Input label="Relationship" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Mother, Son, Spouse" required />
          <Input label="Their phone number" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="08012345678" required hint="The provider calls this number to reach them for the visit." />
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
