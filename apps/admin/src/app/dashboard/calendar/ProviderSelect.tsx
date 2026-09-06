"use client";
import { useRouter } from "next/navigation";

export default function ProviderSelect({
  providers, selectedId,
}: {
  providers: { id: string; name: string; profession: string }[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <select
      className="input max-w-xs"
      value={selectedId}
      onChange={e => router.push(`/dashboard/calendar?providerId=${e.target.value}`)}
    >
      {providers.map(p => (
        <option key={p.id} value={p.id}>{p.name} ({p.profession})</option>
      ))}
    </select>
  );
}
