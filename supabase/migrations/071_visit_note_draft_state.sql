-- ============================================================
-- Migration 071: Keep everything on a visit note draft
--
-- Vitals and diagnoses only reach their own tables on submit, and some
-- fields have no column at all (medication and allergy notes, follow up
-- type and reason), so a draft had nowhere to keep them. draft_state holds
-- those plus the step the provider was on. Submitting clears it.
-- ============================================================

ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS draft_state jsonb;
ALTER TABLE nursing_encounters ADD COLUMN IF NOT EXISTS draft_state jsonb;
ALTER TABLE physiotherapy_encounters ADD COLUMN IF NOT EXISTS draft_state jsonb;

NOTIFY pgrst, 'reload schema';
