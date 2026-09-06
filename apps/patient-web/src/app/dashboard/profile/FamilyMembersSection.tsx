"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface FamilyMember { id: string; name: string; relationship: string }

export default function FamilyMembersSection({ initialMembers }: { initialMembers: FamilyMember[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function removeMember(id: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from your family members? Past bookings made for them will be kept, just no longer linked to them.`)) return;
    setRemovingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    setRemovingId(null);
    if (error) { alert("Could not remove. Please try again."); return; }
    setMembers(prev => prev.filter(m => m.id !== id));
    router.refresh();
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
    setAdding(false);
    setName("");
    setRelationship("");
    router.refresh();
  }

  return (
    <div className="card p-6 mb-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Family Members</h2>

      {members.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">You haven't added anyone yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-400">{m.relationship}</p>
              </div>
              <button
                onClick={() => removeMember(m.id, m.name)}
                disabled={removingId === m.id}
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                {removingId === m.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="text-sm text-blue-brand font-medium hover:underline">
          + Add family member
        </button>
      ) : (
        <form onSubmit={addMember} className="space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adaeze Okafor" required />
          </div>
          <div>
            <label className="label">Relationship</label>
            <input className="input" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Mother, Son, Spouse" required />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-2">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(""); }} className="text-xs text-gray-500 font-medium px-4 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
