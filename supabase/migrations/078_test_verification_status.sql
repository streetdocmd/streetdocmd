-- ============================================================
-- Migration 078: 'test' verification status
--
-- Seeded test providers must stay usable by the team but never reach
-- patients. Everything patient facing (search, booking by code, dispatch,
-- the mobile apps) already requires verification_status = 'verified', so a
-- separate status hides them without touching any of those paths. They also
-- stay out of the admin review queue, which lists pending and under_review.
--
-- Test facilities use the existing active = false instead.
-- scripts/test-accounts.mjs moves accounts in and out of this state.
--
-- Additive and idempotent.
-- ============================================================

ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_verification_status_check;
ALTER TABLE providers ADD CONSTRAINT providers_verification_status_check
  CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected', 'test'));
