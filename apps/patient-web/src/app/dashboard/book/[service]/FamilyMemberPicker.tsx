"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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
    <div className="card p-5 space-y-3">
      <p className="font-semibold text-gray-900 text-sm">Who is this visit for?</p>

      <div className="space-y-2">
        <label className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer has-[:checked]:border-blue-brand has-[:checked]:bg-blue-50">
          <input
            type="radio"
            name="family_member"
            checked={selected === null}
            onChange={() => select(null)}
            className="accent-blue-brand"
          />
          <span className="text-sm font-medium text-gray-900">Myself</span>
        </label>

        {members.map(m => (
          <label
            key={m.id}
            className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer has-[:checked]:border-blue-brand has-[:checked]:bg-blue-50"
          >
            <input
              type="radio"
              name="family_member"
              checked={selected === m.id}
              onChange={() => select(m.id)}
              className="accent-blue-brand"
            />
            <span className="text-sm font-medium text-gray-900">{m.name}</span>
            <span className="text-xs text-gray-400">· {m.relationship}</span>
          </label>
        ))}
      </div>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-blue-brand font-medium hover:underline"
        >
          + Add someone else
        </button>
      ) : (
        <form onSubmit={addMember} className="space-y-3 border-t border-gray-100 pt-3">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Adaeze Okafor"
              required
            />
          </div>
          <div>
            <label className="label">Relationship</label>
            <input
              className="input"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              placeholder="e.g. Mother, Son, Spouse"
              required
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-2">
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(""); }}
              className="text-xs text-gray-500 font-medium px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
