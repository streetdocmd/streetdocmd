"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cx, focusRing } from "@/components/ds";
import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_URL } from "@/lib/brand";

// Not before sign in (welcome, sign in, sign up and password screens
// show the support email instead), and not on pages with their own
// fixed bottom bar, where the button would cover it
const HIDDEN_ON = [/^\/$/, /^\/(login|register|forgot-password|reset-password)(\/|$)/, /^\/share\//, /^\/zz-preview/];
const MESSAGE = "Hello StreetdocMD, I need some help.";

function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.67 12.06c0 2 .53 3.96 1.52 5.68L.57 23.65l6.04-1.58a11.33 11.33 0 0 0 5.43 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.05" />
    </svg>
  );
}

// Floating concierge: a WhatsApp button that opens a short card leading to
// StreetdocMD customer care. Sits above the bottom tab bar on phones.
export default function WhatsAppConcierge() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_ON.some(r => r.test(pathname))) return null;
  // Signed in screens have a bottom tab bar on phones
  const raised = pathname.startsWith("/dashboard");
  const href = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <div className={cx("fixed right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6", raised ? "bottom-[92px]" : "bottom-5")}>
      {open && (
        <div role="dialog" aria-label="Customer care on WhatsApp"
          className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-ds-lg border border-line bg-surface text-ink shadow-ds">
          <div className="flex items-start justify-between gap-3 bg-[#075E54] px-4 py-3.5 text-white">
            <div>
              <b className="block text-ds-md">StreetdocMD care team</b>
              <small className="text-ds-xs text-white/85">Usually replies within minutes</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"
              className={cx("grid h-8 w-8 flex-none place-items-center rounded-full hover:bg-white/15", focusRing)}>
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <p className="rounded-ds rounded-tl-sm bg-page px-3.5 py-2.5 text-ds-sm">
              Hi! Need help with a booking, a payment or your care? Chat with us on WhatsApp.
            </p>
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className={cx("flex min-h-12 items-center justify-center gap-2 rounded-pill bg-[#25D366] px-5 text-ds-control font-bold text-[#073B33] hover:brightness-95", focusRing)}>
              <WhatsAppIcon size={20} /> Start chat
            </a>
            <p className="text-center text-ds-xs text-muted">{SUPPORT_WHATSAPP.replace(/^\+234/, "+234 ").replace(/(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3")}</p>
            <p className="text-center text-[11px] text-muted">For a medical emergency, call 112 instead.</p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close customer care" : "Chat with customer care on WhatsApp"}
        aria-expanded={open}
        className={cx("grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-transform hover:scale-105", focusRing)}
      >
        {open ? <X size={24} aria-hidden /> : <WhatsAppIcon />}
      </button>
    </div>
  );
}
