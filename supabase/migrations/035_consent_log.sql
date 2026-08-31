-- ============================================================
-- Migration 035: Consent log (Core Consent pass)
--
-- Adds a versioned, auditable record of patient consent — separate from
-- the pre-existing users.ndpr_consent boolean (which the current /register
-- route never actually sets; left untouched, out of scope for this pass).
--
-- consent_log is an append-only audit trail: each grant/withdrawal/update
-- is its own row rather than an overwritten field, so history is never
-- lost. This pass only writes 'core' consent at signup; the other
-- consent_type values are reserved for already-scoped future passes
-- (care_team, facility, location, marketing, uploads, family_member) —
-- adding them here now means those passes won't need a schema migration
-- of their own, just new INSERTs using values already allowed by the
-- CHECK constraint.
-- ============================================================

CREATE TABLE IF NOT EXISTS consent_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid REFERENCES users(id),
  consent_type    text CHECK (consent_type IN (
                    'core', 'care_team', 'facility', 'location',
                    'marketing', 'uploads', 'family_member'
                  )),
  action          text CHECK (action IN ('granted', 'withdrawn', 'updated')),
  policy_version  text NOT NULL,
  context         text, -- e.g. 'signup', 'settings', 'referral:LAB_PARTNER_ID'
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_log_patient_idx ON consent_log(patient_id);
CREATE INDEX IF NOT EXISTS consent_log_type_idx ON consent_log(consent_type);

ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

-- Append-only from the client's perspective: a patient can read and add
-- to their own consent history, but never edit or delete a past entry.
-- (The signup insert itself goes through the admin/service-role client
-- in /api/register, which bypasses RLS entirely — these policies exist
-- for future passes where a signed-in patient's own session writes
-- directly, e.g. toggling care-team sharing in Settings.)
DO $$ BEGIN
  CREATE POLICY consent_log_patient_read ON consent_log
    FOR SELECT USING (patient_id = auth.uid() OR get_user_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY consent_log_patient_insert ON consent_log
    FOR INSERT WITH CHECK (patient_id = auth.uid() OR get_user_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users: which policy version a patient last accepted ──────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS core_consent_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS core_consent_policy_version text;
