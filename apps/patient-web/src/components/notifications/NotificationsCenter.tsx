"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, Card, Toggle, cx } from "@/components/ds";
import {
  CATEGORY_INFO, currentSubscription, disableWebPush, enableWebPush, pushSupported, timeAgo,
  type Channel, type NotificationItem, type Prefs,
} from "@/lib/notifications";

// Inbox plus per-category email and push settings (migration 065)
export default function NotificationsCenter({ userId, categories }: { userId: string; categories: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [push, setPush] = useState<"on" | "off" | "denied" | "unsupported" | "busy">("off");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("notifications").select("id, category, title, body, link, read_at, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setItems((data ?? []) as NotificationItem[]));
    supabase.from("notification_preferences").select("prefs").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setPrefs((data?.prefs ?? {}) as Prefs));
    if (!pushSupported()) setPush("unsupported");
    else if (Notification.permission === "denied") setPush("denied");
    else currentSubscription().then(s => setPush(s ? "on" : "off"));
  }, [userId]);

  async function setPref(cat: string, ch: Channel, on: boolean) {
    const next = { ...prefs, [cat]: { ...prefs[cat], [ch]: on } };
    setPrefs(next);
    const { error } = await createClient().from("notification_preferences")
      .upsert({ user_id: userId, prefs: next, updated_at: new Date().toISOString() });
    setMsg(error ? "Couldn't save your settings. Please try again." : "Saved");
    setTimeout(() => setMsg(""), 2000);
  }

  async function togglePush() {
    if (push === "on") {
      setPush("busy");
      await disableWebPush();
      setPush("off");
      return;
    }
    setPush("busy");
    const r = await enableWebPush(userId);
    setPush(r === "on" ? "on" : r === "denied" ? "denied" : r === "unsupported" ? "unsupported" : "off");
    if (r === "error") setMsg("Couldn't turn on notifications in this browser. Please try again.");
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems(prev => prev?.map(n => ({ ...n, read_at: n.read_at ?? now })) ?? null);
    await createClient().from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
  }

  async function openItem(n: NotificationItem) {
    if (!n.read_at) await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    if (n.link) router.push(n.link);
    else setItems(prev => prev?.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null);
  }

  const unread = (items ?? []).filter(n => !n.read_at).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-navy">Inbox</h2>
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-ds-sm font-bold text-accent hover:underline">
              <CheckCheck size={15} aria-hidden /> Mark all as read
            </button>
          )}
        </div>
        <Card padded={false} className="overflow-hidden">
          {items === null ? (
            <p className="p-6 text-ds-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-page text-muted"><Inbox size={20} aria-hidden /></span>
              <p className="text-ds-sm text-muted">No notifications yet. Updates about your account will appear here.</p>
            </div>
          ) : items.map(n => (
            <button key={n.id} type="button" onClick={() => openItem(n)}
              className={cx("flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left last:border-0", n.read_at ? "hover:bg-page" : "bg-accent-soft/50 hover:bg-accent-soft")}>
              <span className="min-w-0 flex-1">
                <b className={cx("block text-ds-sm text-ink", !n.read_at && "font-extrabold")}>{n.title}</b>
                <span className="mt-0.5 block text-ds-sm text-ink/80">{n.body}</span>
                <span className="mt-1 block text-ds-xs text-muted">{CATEGORY_INFO[n.category]?.label ?? "Update"} · {timeAgo(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" aria-label="Unread" />}
            </button>
          ))}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-bold text-navy">Settings</h2>
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-accent-soft text-accent"><BellRing size={18} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <b className="block text-ds-sm text-ink">Notifications in this browser</b>
              <small className="block text-ds-xs text-muted">
                {push === "on" ? "On. You'll get alerts here even when StreetdocMD isn't open."
                  : push === "denied" ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
                  : push === "unsupported" ? "This browser doesn't support them. On iPhone, add StreetdocMD to your home screen first."
                  : "Get alerts on this device as things happen."}
              </small>
              {(push === "on" || push === "off" || push === "busy") && (
                <Button size="sm" variant={push === "on" ? "secondary" : "primary"} className="mt-2.5" disabled={push === "busy"} onClick={togglePush}>
                  {push === "busy" ? "One moment…" : push === "on" ? "Turn off" : "Turn on"}
                </Button>
              )}
            </div>
          </div>
        </Card>
        <Card padded={false}>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line px-4 py-2.5 text-ds-xs font-bold text-muted">
            <span>Send me</span><span>Email</span><span>Push</span>
          </div>
          {categories.map(cat => (
            <div key={cat} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line px-4 py-3 last:border-0">
              <span className="min-w-0">
                <b className="block text-ds-sm text-ink">{CATEGORY_INFO[cat]?.label ?? cat}</b>
                <small className="block text-ds-xs text-muted">{CATEGORY_INFO[cat]?.text}</small>
              </span>
              <Toggle label={`${CATEGORY_INFO[cat]?.label ?? cat} by email`} checked={prefs[cat]?.email !== false} onChange={v => setPref(cat, "email", v)} />
              <Toggle label={`${CATEGORY_INFO[cat]?.label ?? cat} by push`} checked={prefs[cat]?.push !== false} onChange={v => setPref(cat, "push", v)} />
            </div>
          ))}
        </Card>
        <p className="text-ds-xs text-muted" role="status">{msg || "Everything also appears in your inbox here, whatever you choose."}</p>
      </section>
    </div>
  );
}
