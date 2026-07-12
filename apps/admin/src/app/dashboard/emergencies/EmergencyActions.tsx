"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcknowledgeResolve({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "acknowledge" | "resolve") {
    setLoading(true);
    await fetch(`/api/emergency/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    router.refresh();
  }

  if (status === "resolved") return <span className="text-xs text-gray-400">Resolved</span>;

  return (
    <div className="flex gap-2">
      {status === "active" && (
        <button
          onClick={() => act("acknowledge")}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Acknowledge
        </button>
      )}
      <button
        onClick={() => act("resolve")}
        disabled={loading}
        className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        Resolve
      </button>
    </div>
  );
}

export function AddContactForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("ops");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError("Name and phone are required."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/emergency-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), role }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
    setName(""); setPhone(""); setRole("ops");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Amaka Obi"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand w-44" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Phone</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08012345678"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand w-40" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
        <select value={role} onChange={e => setRole(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand">
          <option value="ops">Ops</option>
          <option value="medical">Medical Lead</option>
          <option value="ambulance">Ambulance</option>
        </select>
      </div>
      <button type="submit" disabled={loading}
        className="px-4 py-2 bg-blue-brand text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? "Adding…" : "Add Contact"}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}

export function ToggleContact({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/emergency-contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
        isActive
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}>
      {loading ? "…" : isActive ? "Active" : "Inactive"}
    </button>
  );
}

export function DeleteContact({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function del() {
    if (!confirm("Remove this contact?")) return;
    setLoading(true);
    await fetch(`/api/emergency-contacts/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={del} disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
      {loading ? "…" : "Remove"}
    </button>
  );
}