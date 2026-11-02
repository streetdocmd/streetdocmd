// Credential documents go through our upload API, and the host rejects request
// bodies over about 4.5 MB. Phone photos are often bigger than that, so images
// are shrunk in the browser first; a PDF can't be, so it has to fit as it is.
const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_PDF = 4 * 1024 * 1024;
const MAX_UPLOAD = 4 * 1024 * 1024;
const SHRINK_OVER = 1.5 * 1024 * 1024;
const MAX_EDGE = 2400;

export const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const DOC_HINT = "PDF up to 4 MB, or a clear photo (JPG or PNG)";

function shrink(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      // White behind transparent PNGs, which JPEG can't keep
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => (blob ? resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })) : reject(new Error("no blob"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

/** A file ready to upload, or the reason it can't be. */
export async function prepareDocument(file: File): Promise<{ file: File } | { error: string }> {
  if (!ALLOWED.includes(file.type)) return { error: "Please choose a PDF, JPG or PNG file." };
  if (file.size === 0) return { error: "This file is empty. Please choose another." };
  if (file.type === "application/pdf") {
    return file.size > MAX_PDF
      ? { error: "This PDF is larger than 4 MB. Please choose a smaller scan, or upload a photo of the document instead." }
      : { file };
  }
  if (file.size <= SHRINK_OVER) return { file };
  try {
    const small = await shrink(file);
    return small.size > MAX_UPLOAD ? { error: "This photo is too large. Please take it again a little further away." } : { file: small };
  } catch {
    return { error: "We couldn't read this image. Please choose another file." };
  }
}
