-- ============================================================
-- Migration 077: Waitlist sign-ups from the landing page
--
-- The Contact page form saves here. The public key can only add a row: it
-- can't read, change or delete any, and it can only fill in the form's own
-- columns. Staff read the list on the admin dashboard with the service role.
--
-- One row per email address. Signing up twice gets a unique-violation, which
-- the landing page treats as success so the form can't be used to find out
-- who is already on the list.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  email      text NOT NULL CHECK (char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone      text CHECK (char_length(phone) <= 30),
  city       text CHECK (char_length(city) <= 100),
  role       text NOT NULL CHECK (role IN ('patient', 'doctor', 'nurse', 'physiotherapist', 'laboratory', 'pharmacy', 'hospital')),
  message    text CHECK (char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_key ON public.waitlist_signups (lower(email));

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;
GRANT INSERT (full_name, email, phone, city, role, message) ON public.waitlist_signups TO anon;

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can join the waitlist" ON public.waitlist_signups
  FOR INSERT TO anon WITH CHECK (true);
