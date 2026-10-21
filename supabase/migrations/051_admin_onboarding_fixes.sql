-- ============================================================
-- Migration 051: Admin onboarding fixes
--
--   1. verification_logs.action — allow 'under_review'. "Mark under review"
--      in the admin console was recorded as 'reinstated' because the check
--      from 001 only allowed approved/rejected/suspended/reinstated. The
--      admin API now writes 'under_review' and falls back to 'reinstated'
--      if this migration hasn't been applied, so it is safe in either order.
--      NOT VALID: existing rows are not re-checked (they all pass anyway).
--
--   2. Index on providers.verification_status — the admin sidebar, overview
--      and verification queue count/filter by it on every page load.
--
-- Additive only.
-- ============================================================

ALTER TABLE verification_logs DROP CONSTRAINT IF EXISTS verification_logs_action_check;
ALTER TABLE verification_logs ADD CONSTRAINT verification_logs_action_check
  CHECK (action IN ('approved', 'rejected', 'suspended', 'reinstated', 'under_review')) NOT VALID;

CREATE INDEX IF NOT EXISTS providers_verification_status_idx ON providers (verification_status);
