// Phone handling for patient sign-up / profile forms.
//
// users.phone is UNIQUE, so the same number typed as "0801 234 5678",
// "+2348012345678" and "2348012345678" must collapse to one stored value or
// the uniqueness check is meaningless. Nigerian mobiles are stored in the
// local 0XXXXXXXXXX form (the format shown in every placeholder and used by
// providers to call patients). Non-Nigerian numbers — e.g. a relative abroad
// booking for a parent — are accepted in international +<digits> form.

const NG_LOCAL = /^0[789][01]\d{8}$/;

export function normalizePhone(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  let local: string | null = null;
  if (digits.startsWith("234") && digits.length === 13) local = `0${digits.slice(3)}`;
  else if (digits.length === 11 && digits.startsWith("0")) local = digits;
  else if (digits.length === 10 && !hasPlus && /^[789]/.test(digits)) local = `0${digits}`;

  if (local && NG_LOCAL.test(local)) return local;
  if (hasPlus && !digits.startsWith("234") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export const PHONE_ERROR = "Enter a valid phone number, e.g. 08012345678";
