"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cx, focusRing } from "@/components/ds";
import { timeAgo, type NotificationItem } from "@/lib/notifications";

// Bell with a live unread count and the latest notifications (migration 065)
export default function NotificationBell({ userId, inboxHref }: { userId: string; inboxHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  async function load() {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase.from("notifications").select("id, category, title, body, link, read_at, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("read_at", null),
    ]);
    setItems((data ?? []) as NotificationItem[]);
    setUnread(count ?? 0);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, payload => {
        load();
        // Not when they're already looking at it, e.g. the same chat
        const n = payload.new as NotificationItem;
        if (payload.eventType === "INSERT" && n.link !== pathRef.current) setToast(n);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  }

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read_at) {
      setUnread(u => Math.max(0, u - 1));
      await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    router.push(n.link || inboxHref);
  }

  return (
    <div className="relative" ref={wrapRef}>
      {toast && (
        <div role="status" className="fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-sm items-start gap-2 rounded-ds-lg border border-line bg-surface p-3 shadow-ds sm:left-auto sm:right-4 sm:mx-0">
          <button type="button" onClick={() => { const n = toast; setToast(null); openItem(n); }} className={cx("min-w-0 flex-1 rounded-ds-sm text-left", focusRing)}>
            <b className="block truncate text-ds-sm text-ink">{toast.title}</b>
            {toast.body && <span className="line-clamp-2 text-ds-xs text-muted">{toast.body}</span>}
          </button>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className={cx("grid h-7 w-7 flex-none place-items-center rounded-full text-muted hover:bg-page", focusRing)}>
            <X size={15} aria-hidden />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={cx("relative grid h-10 w-10 place-items-center rounded-full text-navy transition-colors hover:bg-page", focusRing)}
      >
        <Bell size={19} strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-ds-lg border border-line bg-surface text-ink shadow-ds sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-bold text-navy">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-ds-xs font-bold text-accent hover:underline">
                <CheckCheck size={13} aria-hidden /> Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-page text-muted"><Inbox size={20} aria-hidden /></span>
                <p className="text-ds-sm text-muted">You&apos;re all caught up</p>
              </div>
            ) : items.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={cx(
                  "flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-0",
                  n.read_at ? "hover:bg-page" : "bg-accent-soft/50 hover:bg-accent-soft",
                )}
              >
                <span className="min-w-0 flex-1">
                  <b className={cx("block text-ds-sm text-ink", !n.read_at && "font-extrabold")}>{n.title}</b>
                  <span className="mt-0.5 line-clamp-2 block text-ds-xs text-muted">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" aria-label="Unread" />}
              </button>
            ))}
          </div>
          <Link href={inboxHref} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-ds-sm font-bold text-accent hover:bg-page">
            See all and settings
          </Link>
        </div>
      )}
    </div>
  );
}
