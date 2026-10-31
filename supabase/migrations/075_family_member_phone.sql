-- ============================================================
-- Migration 075: A phone number for anyone booked for someone else
--
-- When a patient books a visit for a family member, the provider needs to
-- reach the person being seen, not only the account holder. New bookings
-- for a family member require it (patient-web /api/bookings).
-- ============================================================

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS phone text;

NOTIFY pgrst, 'reload schema';
