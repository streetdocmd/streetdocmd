-- Add resolution notes column to safeguarding_alerts (used by admin resolve flow)
ALTER TABLE safeguarding_alerts
  ADD COLUMN IF NOT EXISTS notes text;

-- NOTE: The 'referral-letters' storage bucket must be created manually in the
-- Supabase dashboard (Storage > New bucket > referral-letters, set to public).
-- This bucket stores generated PDF referral letters.

-- NOTE: The 'facility-applications' storage bucket must also exist
-- (Storage > New bucket > facility-applications, set to private).
-- This bucket stores facility registration documents.
