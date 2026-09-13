"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, UserX, CheckCheck, Inbox, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface NotificationRow {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Maps the notification "type" values that actually get written to
// notifications_queue (see 033_elderly_follow_up_handoff.sql,
// 037_preferred_provider_by_code.sql, 041_care_team_chat_and_followup_reminders.sql,
// and the clinical-note submit route) to a display label, icon, and the
// existing screen most relevant to it. Never invents a destination —
// every href below is a route that already exists.
const TYPE_META: Record<string, { icon: typeof Bell; label: string; href: string }> = {
  follow_up: { icon: CalendarClock, label: "Follow-up reminder", href: "/dashboard/my-care" },
  follow_up_care: { icon: CalendarClock, label: "Follow-up recommended", href: "/dashboard/my-care" },
  follow_up_reminder: { icon: CalendarClock, label: "Follow-up reminder", href: "/dashboard/my-care" },
  preferred_provider_declined: { icon: UserX, label: "Provider unavailable", href: "/dashboard/bookings" },
};
const DEFAULT_META = { icon: Bell, label: "Notification", href: "/dashboard/bookings" };

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function NotificationBell({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter(n => !n.is_read).length;

  async function load() {
    setLoading(true);
    setError(false);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("notifications_queue")
      .select("id, type, message, is_read, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (err) { setError(true); setLoading(false); return; }
    setItems((data as NotificationRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`patient-notifications-${patientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications_queue", filter: `patient_id=eq.${patientId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    const supabase = createClient();
    await supabase.from("notifications_queue").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    const unreadIds = items.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    const supabase = createClient();
    await supabase.from("notifications_queue").update({ is_read: true, read_at: new Date().toISOString() }).in("id", unreadIds);
  }

  function openNotification(n: NotificationRow) {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    router.push((TYPE_META[n.type] ?? DEFAULT_META).href);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell size={19} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-3 top-[4.25rem] sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 text-gray-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-brand font-medium hover:underline">
                <CheckCheck size={13} /> Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle size={22} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-2">Couldn't load notifications.</p>
                <button onClick={load} className="text-xs text-blue-brand font-medium hover:underline">Try again</button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-2">
                  <Inbox size={20} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">No new notifications</p>
              </div>
            ) : (
              items.map(n => {
                const meta = TYPE_META[n.type] ?? DEFAULT_META;
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={`w-full flex items-start gap-3 text-left px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                      n.is_read ? "hover:bg-gray-50" : "bg-blue-light/50 hover:bg-blue-light"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.is_read ? "bg-gray-100 text-gray-400" : "bg-white text-blue-brand"}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.is_read ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}>{meta.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-brand mt-1.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
