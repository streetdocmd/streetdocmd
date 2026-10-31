"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar, DrugImage, cx, focusRing, type AvatarSize, useDialog } from "@/components/ds";

// Shrinks the picture in the browser before upload, so it's quick on mobile
// data: avatars are cropped square to 512px, product pictures fit in 900px.
async function shrink(file: File, square: boolean): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = square ? 512 : 900;
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.85));
}

/** Shrinks and uploads a picture; returns its URL or throws a readable error */
export async function uploadPicture(endpoint: string, file: File, square = false): Promise<string | null> {
  const blob = await shrink(file, square).catch(() => file);
  const form = new FormData();
  form.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
  const res = await fetch(endpoint, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Couldn't upload the picture. Please try again.");
  return json.url ?? null;
}

/**
 * A picture with buttons to change or remove it. `endpoint` takes POST with
 * a "file" form field and DELETE to remove.
 */
export default function PhotoUpload({
  name, src, endpoint, size = "lg", tint, variant = "avatar", label = "photo", className, onChange,
}: {
  name: string;
  src: string | null;
  endpoint: string;
  size?: AvatarSize;
  tint?: string;
  /** "product" keeps the picture's shape instead of cropping it square */
  variant?: "avatar" | "product";
  /** Used in button text, e.g. "photo", "logo", "picture" */
  label?: string;
  className?: string;
  /** Called with the new URL (or null) after a change is saved */
  onChange?: (url: string | null) => void;
}) {
  const dialog = useDialog();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(src);

  async function upload(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) { setError("Choose a picture file."); return; }
    setBusy(true);
    try {
      const url = await uploadPicture(endpoint, file, variant === "avatar");
      setCurrent(url);
      onChange?.(url);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!(await dialog.confirm({ title: `Remove this ${label}?`, confirmLabel: "Remove", tone: "danger" }))) return;
    setBusy(true);
    setError("");
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Couldn't remove it."); return; }
    setCurrent(null);
    onChange?.(null);
    router.refresh();
  }

  return (
    <div className={cx("flex items-center gap-3.5", className)}>
      {variant === "product" ? (
        <DrugImage src={current} alt={name} className="h-16 w-16" />
      ) : (
        <Avatar name={name} src={current} size={size} tint={tint} />
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className={cx("inline-flex items-center gap-1.5 rounded text-ds-sm font-bold text-accent hover:underline disabled:opacity-50", focusRing)}>
            <Camera size={15} aria-hidden /> {busy ? "Uploading…" : current ? `Change ${label}` : `Add a ${label}`}
          </button>
          {current && !busy && (
            <button type="button" onClick={remove} className={cx("rounded text-ds-sm font-bold text-muted hover:text-danger", focusRing)}>Remove</button>
          )}
        </div>
        <small className="mt-0.5 block text-ds-xs text-muted">JPG, PNG or WebP</small>
        {error && <p role="alert" className="mt-1 text-ds-xs font-semibold text-danger">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}
