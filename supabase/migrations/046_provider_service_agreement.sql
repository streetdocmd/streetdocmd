-- ============================================================
-- Migration 046: Provider Service Agreement acceptance record
--
-- Providers must affirmatively accept the StreetdocMD Provider Service
-- Agreement (click-to-accept, version 2.0) on the last step of
-- registration. Clause 21 asks the Platform to record the agreement
-- version, the applicable commission rate / commercial schedule, the
-- affirmative acceptance action and its timestamp — stored here on the
-- provider row (the Provider account itself is providers.user_id).
--
--   agreement_version          e.g. '2.0'; NULL = never accepted (every
--                              provider registered before this migration)
--   agreement_accepted_at      when the unchecked box was ticked and submitted
--   agreement_commission_rate  commission % shown at acceptance (default 20,
--                              clause 8.2); future changes follow clause 8.5
--
-- Additive only: existing rows get NULLs, nothing else changes.
-- ============================================================

ALTER TABLE providers ADD COLUMN IF NOT EXISTS agreement_version text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS agreement_commission_rate numeric(5,2);

COMMENT ON COLUMN providers.agreement_version IS 'Provider Service Agreement version accepted (clause 21); NULL = not yet accepted';
COMMENT ON COLUMN providers.agreement_accepted_at IS 'Timestamp of affirmative click-to-accept of agreement_version';
COMMENT ON COLUMN providers.agreement_commission_rate IS 'Commission percentage displayed to the provider when accepting (clause 8)';
