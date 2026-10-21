import Link from "next/link";
import { SearchX } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="card max-w-lg mx-auto mt-10 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
        <SearchX size={22} aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-gray-900">Not found</h1>
      <p className="text-sm text-gray-500 mt-1">This record doesn&apos;t exist or may have been removed.</p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to overview</Link>
    </div>
  );
}
