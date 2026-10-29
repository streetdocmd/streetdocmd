"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button, cx } from "@/components/ds";

interface Message {
  id: string;
  sender_user_id: string | null;
  sender_role: string;
  sender_label: string;
  body: string;
  kind: "message" | "update";
  created_at: string;
}

const ROLE_TINT: Record<string, string> = {
  provider: "bg-teal-soft text-teal-deep",
  lab: "bg-tint-mint text-ink",
  pharmacy: "bg-tint-yellow text-ink",
  hospital: "bg-tint-rose text-ink",
  admin: "bg-sky text-navy",
};

const time = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

// A care journey's chat (care_journey_messages, migration 068): the care
// team, the facilities handling its orders and StreetdocMD admins. The
// "Care updates" assistant posts each step; people reply. Patients don't see it.
export default function CareChat({ episodeId, userId, closed = false, className }: {
  episodeId: string;
  userId: string;
  closed?: boolean;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    setError("");
    const { data, error: err } = await createClient()
      .from("care_journey_messages")
      .select("id, sender_user_id, sender_role, sender_label, body, kind, created_at")
      .eq("care_episode_id", episodeId)
      .order("created_at")
      .limit(500);
    if (err) { setError("Couldn't load the conversation."); setMessages([]); return; }
    setMessages((data ?? []) as Message[]);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`care-journey-${episodeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "care_journey_messages", filter: `care_episode_id=eq.${episodeId}` },
        payload => setMessages(prev => (prev && !prev.some(m => m.id === (payload.new as Message).id) ? [...prev, payload.new as Message] : prev)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    // Sender, role and name are set by the database from the signed in account
    const { data, error: err } = await createClient()
      .from("care_journey_messages")
      .insert({ care_episode_id: episodeId, body, sender_role: "provider", sender_label: "Care team" })
      .select("id, sender_user_id, sender_role, sender_label, body, kind, created_at")
      .single();
    setSending(false);
    if (err) { setError(err.message.includes("closed") ? "This care journey is closed." : "Couldn't send. Check your connection and try again."); return; }
    setText("");
    setMessages(prev => (prev && !prev.some(m => m.id === data.id) ? [...prev, data as Message] : prev));
  }

  return (
    <div className={cx("flex flex-col overflow-hidden rounded-ds-lg border border-line bg-surface", className)}>
      <div className="max-h-[60vh] min-h-[240px] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages === null ? (
          <p className="text-ds-sm text-muted">Loading the conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-ds-sm text-muted">No messages yet. Updates about this journey will appear here.</p>
        ) : messages.map(m => {
          if (m.kind === "update") {
            return (
              <div key={m.id} className="flex items-start gap-2.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent-soft text-accent"><Bot size={15} aria-hidden /></span>
                <div className="min-w-0 rounded-ds bg-page px-3 py-2">
                  <p className="text-ds-sm text-ink">{m.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted">Care updates · {time(m.created_at)}</p>
                </div>
              </div>
            );
          }
          const mine = m.sender_user_id === userId;
          return (
            <div key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
              {!mine && <span className="mb-0.5 text-[11px] font-bold text-muted">{m.sender_label}</span>}
              <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-ds px-3.5 py-2 text-ds-sm",
                mine ? "bg-accent text-white" : ROLE_TINT[m.sender_role] ?? "bg-page text-ink")}>
                {m.body}
              </div>
              <span className="mt-0.5 text-[11px] text-muted">{time(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-ds-xs font-semibold text-danger">
          {error}
          {messages?.length === 0 && <button type="button" onClick={load} className="font-bold text-accent hover:underline">Retry</button>}
        </p>
      )}

      {closed ? (
        <p className="border-t border-line px-4 py-3 text-ds-xs text-muted">This journey is closed. The conversation is kept for the record.</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <textarea
            aria-label="Message the care team"
            rows={1}
            maxLength={4000}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
            placeholder="Message everyone caring for this patient"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-ds border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-ds-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={sending || !text.trim()} aria-label="Send"><Send size={16} aria-hidden /></Button>
        </form>
      )}
      <p className="border-t border-line bg-page px-4 py-2 text-[11px] text-muted">
        Seen by the care team, the facilities handling this patient&apos;s orders and StreetdocMD. The patient doesn&apos;t see this chat.
      </p>
    </div>
  );
}
