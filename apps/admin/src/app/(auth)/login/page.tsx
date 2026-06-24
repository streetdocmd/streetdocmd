"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-700 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border-2 border-white" />
          <div className="absolute top-40 left-40 w-96 h-96 rounded-full border border-white" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full border-2 border-white" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-24 h-24 bg-white rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-card-md overflow-hidden">
            <Image src="/logo.jpeg" alt="StreetdocMD" width={72} height={72} className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">StreetdocMD</h1>
          <p className="text-blue-300 text-lg tracking-widest uppercase font-medium">
            Care. Anywhere. Anytime.
          </p>
          <div className="mt-12 space-y-4 text-left max-w-xs">
            {[
              { icon: "🗺️", text: "Live operations map" },
              { icon: "🩺", text: "Provider verification console" },
              { icon: "💰", text: "Real-time financial dashboard" },
              { icon: "📊", text: "Platform analytics" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-blue-100">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-navy-700 rounded-xl flex items-center justify-center overflow-hidden">
              <Image src="/logo.jpeg" alt="StreetdocMD" width={32} height={32} className="object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <span className="text-xl font-bold text-navy-700">StreetdocMD</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to the operations dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand focus:border-transparent transition-shadow"
                placeholder="admin@streetdocmd.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-brand focus:border-transparent transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-700 hover:bg-navy-800 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-8">
            StreetdocMD Admin Console · Restricted access
          </p>
        </div>
      </div>
    </div>
  );
}
