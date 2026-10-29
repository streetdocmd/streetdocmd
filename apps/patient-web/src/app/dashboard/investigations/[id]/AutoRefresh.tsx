"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the order every few seconds while Paystack's confirmation reaches
// the webhook, for up to a minute.
export default function AutoRefresh({ every = 4000, max = 15 }: { every?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => { n += 1; router.refresh(); if (n >= max) clearInterval(t); }, every);
    return () => clearInterval(t);
  }, [router, every, max]);
  return null;
}
