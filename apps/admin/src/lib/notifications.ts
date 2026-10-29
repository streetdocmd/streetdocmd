"use client";
// Shared by the notification bell, inbox and settings (migration 065).
import { createClient } from "@/lib/supabase";

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export type Channel = "email" | "push";
export type Prefs = Record<string, Partial<Record<Channel, boolean>>>;

export const CATEGORY_INFO: Record<string, { label: string; text: string }> = {
  visits: { label: "Visits", text: "Requests, acceptances, arrivals and cancellations" },
  orders: { label: "Orders and referrals", text: "Medicines, lab tests and hospital referrals" },
  payments: { label: "Payments and payouts", text: "Receipts, refunds and withdrawals" },
  account: { label: "Account", text: "Verification and document checks" },
  reviews: { label: "Reviews", text: "New ratings and comments" },
  admin: { label: "Admin alerts", text: "Verifications, applications, refunds and safeguarding" },
};

// The browser push key pair's public half (the private half is an Edge
// Function secret). Safe to ship; NEXT_PUBLIC_VAPID_PUBLIC_KEY overrides it.
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BPbTxGDKhg5WN0M-QPgUMgTj4x8iY54rESGsLZUeu09V-sWO7en59G234fDEAwkKKlhA2JxxQg-nWFwAaK1zNN8";

export function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** This browser's current push subscription, if any */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks permission, subscribes this browser and saves it for the signed in user */
export async function enableWebPush(userId: string): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const { error } = await createClient().from("push_subscriptions").upsert({
      user_id: userId,
      kind: "web",
      token: sub.endpoint,
      keys: json.keys ?? null,
      user_agent: navigator.userAgent.slice(0, 300),
    }, { onConflict: "token" });
    return error ? "error" : "on";
  } catch {
    return "error";
  }
}

export async function disableWebPush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await createClient().from("push_subscriptions").delete().eq("token", sub.endpoint);
  await sub.unsubscribe();
}
