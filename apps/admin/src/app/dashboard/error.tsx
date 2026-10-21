"use client";

import { TriangleAlert, RefreshCw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card max-w-lg mx-auto mt-10 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
        <TriangleAlert size={22} aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-gray-900">This page couldn&apos;t load</h1>
      <p className="text-sm text-gray-500 mt-1">
        {error.message || "Something went wrong while loading this page."}
      </p>
      {error.digest && <p className="text-xs text-gray-400 mt-2 font-mono">Ref: {error.digest}</p>}
      <button onClick={reset} className="btn-primary mt-6">
        <RefreshCw size={15} aria-hidden />
        Try again
      </button>
    </div>
  );
}
