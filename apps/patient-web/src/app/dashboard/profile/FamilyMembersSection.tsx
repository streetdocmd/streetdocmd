"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Avatar, Button, Card, Input, cx, focusRing, useDialog } from "@/components/ds";

interface FamilyMember { id: string; name: string; relationship: string; dob?: string | null; phone?: string | null }

const TINTS = ["var(--tint-amber)", "var(--tint-mint)", "var(--tint-violet)", "var(--tint-rose)", "var(--tint-blue)"];

function age(dob?: string | null) {
  if (!dob) return null;
  const years = Math.floor((Date.now() - new Date(`${dob}T00:00:00`).getTime()) / (365.25 * 86_400_000));
  return years >= 0 ? years : null;
}

export default function FamilyMembersSection({ initialMembers }: { initialMembers: FamilyMember[] }) {
  const dialog = useDialog();
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function removeMember(id: string, memberName: string) {
    if (!(await dialog.confirm({ title: `Remove ${memberName}?`, message: "Past bookings made for them are kept, just no longer linked to them.", confirmLabel: "Remove", tone: "danger" }))) return;
    setRemovingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    setRemovingId(null);
    if (error) { await dialog.alert({ title: "Couldn't remove", message: "Please try again." }); return; }
    setMembers(prev => prev.filter(m => m.id !== id));
    router.refresh();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !relationship.trim()) return;
    if (!(phone.replace(/\D/g, "").length >= 10)) { setError("Enter their phone number, e.g. 08012345678, so a provider can reach them."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("family_members")
      .insert({ account_holder_id: user!.id, name: name.trim(), relationship: relationship.trim(), dob: dob || null, phone: phone.trim() })
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) { setError(error?.message ?? "Could not add family member"); return; }
    setMembers(prev => [...prev, data]);
    setAdding(false);
    setName("");
    setRelationship("");
    setDob("");
    setPhone("");
    router.refresh();
  }

  return (
    <>
      {members.length === 0 ? (
        <Card className="text-center text-ds-sm text-muted">You haven&apos;t added anyone yet.</Card>
      ) : (
        <Card padded={false} className="px-4 py-1">
          {members.map((m, i) => {
            const years = age(m.dob);
            return (
              <div key={m.id} className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
                <Avatar name={m.name} size="sm" tint={TINTS[i % TINTS.length]} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-ds-sm text-ink">{m.name}</b>
                  <small className="text-ds-xs text-muted">{[m.relationship, years !== null && `${years}`, m.phone].filter(Boolean).join(" · ")}</small>
                  {!m.phone && <small className="block text-ds-xs font-semibold text-warn">Add a phone number when you next book for them</small>}
                </div>
                <Button href="/dashboard" variant="secondary" size="xs">Book</Button>
                <button
                  type="button"
                  onClick={() => removeMember(m.id, m.name)}
                  disabled={removingId === m.id}
                  className={cx("text-ds-xs font-bold text-danger hover:underline disabled:opacity-50 rounded-sm", focusRing)}
                >
                  {removingId === m.id ? "Removing…" : "Remove"}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {!adding ? (
        <Button block className="mt-4" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden /> Add a family member
        </Button>
      ) : (
        <form onSubmit={addMember} className="mt-4 space-y-3 rounded-ds-lg border border-line bg-surface p-4">
          <Input label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adaeze Okafor" required />
          <Input label="Relationship" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Mother, Son, Spouse" required />
          <Input label="Their phone number" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="08012345678" required hint="A provider calls this number to reach them for a visit." />
          <Input label={<>Date of birth <span className="font-normal text-muted">(optional)</span></>} type="date" value={dob}
            onChange={e => setDob(e.target.value)} max={new Date().toISOString().split("T")[0]} />
          {error && <p className="text-ds-xs font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
    </>
  );
}
