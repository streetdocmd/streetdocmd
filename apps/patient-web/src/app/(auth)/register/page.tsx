"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [ndpr, setNdpr] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!ndpr) { setError("You must accept the data privacy consent to continue."); return; }
    setError("");
    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from("users").insert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: "patient",
      });
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-white font-bold text-xl">StreetdocMD</span>
          </div>
          <p className="text-blue-200 text-sm">Home healthcare, on demand</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
          <p className="text-gray-500 text-sm mb-6">Get care delivered to your door</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input type="text" className="input" placeholder="Chukwuemeka Obi" value={form.name} onChange={set("name")} required />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input type="tel" className="input" placeholder="08012345678" value={form.phone} onChange={set("phone")} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="At least 8 characters" value={form.password} onChange={set("password")} minLength={8} required />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ndpr} onChange={e => setNdpr(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-brand" />
              <span className="text-sm text-gray-600">
                I consent to StreetdocMD collecting and processing my health data as described in the{" "}
                <span className="text-blue-brand underline cursor-pointer">Privacy Policy</span> (NDPR compliance).
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !ndpr} className="btn-primary w-full flex justify-center">
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-brand font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}