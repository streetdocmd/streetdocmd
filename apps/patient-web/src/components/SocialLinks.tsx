import { SOCIAL_LINKS, type SocialLink } from "@/lib/brand";

// "Follow us" row for StreetdocMD's social accounts (list lives in SOCIAL_LINKS).
// variant "light" for white menus/cards, "dark" for the navy sidebar.
export default function SocialLinks({ variant = "light", className = "" }: { variant?: "light" | "dark"; className?: string }) {
  if (SOCIAL_LINKS.length === 0) return null;
  const dark = variant === "dark";
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className={`text-xs font-medium ${dark ? "text-blue-200/70" : "text-muted"}`}>Follow us</span>
      <div className="flex items-center gap-1">
        {SOCIAL_LINKS.map(s => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`StreetdocMD on ${s.label} (${s.handle})`}
            title={`${s.label} · ${s.handle}`}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              dark ? "text-blue-200 hover:text-white hover:bg-white/10" : "text-muted hover:text-accent hover:bg-accent-soft"
            }`}
          >
            <SocialIcon id={s.id} />
          </a>
        ))}
      </div>
    </div>
  );
}

export function SocialIcon({ id, size = 16 }: { id: SocialLink["id"]; size?: number }) {
  if (id === "instagram") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.56V4.63a20.8 20.8 0 0 0-2.27-.12c-2.25 0-3.79 1.37-3.79 3.9v2.16H7.92v2.94h2.54V21h3.04Z" />
      </svg>
    );
  }
  if (id === "tiktok") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.42-2.47V9.67a5.7 5.7 0 0 0-.82-.06A5.69 5.69 0 0 0 4.17 15.3 5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.28 1.37V7.3a4.27 4.27 0 0 1-3.23-1.48Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}
