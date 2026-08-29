-- ============================================================
-- Migration 027: Fix a live RLS bypass on clinical_notes
--
-- Live-tested by signing in as a real nurse provider account and
-- attempting to INSERT into clinical_notes directly via the REST API
-- (bypassing the app's own UI/API guards entirely, the way a malicious
-- or buggy client could). The insert succeeded — it should have been
-- rejected.
--
-- Root cause: pg_policies shows a policy named `clinical_notes_access`
-- on this table (ALL commands, USING = provider-owns-row OR
-- patient-owns-row OR admin — no profession check) that does not exist
-- in any migration file in this repo. It isn't 016's
-- `providers_own_notes`/`patients_read_own_notes` (016's actual policy
-- names) — someone created or replaced this policy directly against the
-- database outside of the migration history at some point, similar to
-- how 016's own header comment already warned some tables were
-- "referenced in code but had no migration."
--
-- Migration 023 added a second, correctly doctor-scoped policy
-- (`providers_own_notes`) alongside it rather than in place of it —
-- RLS PERMISSIVE policies are OR'd together, so the pre-existing
-- unrestricted policy silently made the new restriction meaningless:
-- any provider of any profession, not just doctors, could read or
-- write clinical_notes rows.
--
-- Fix: drop the unrestricted policy. Its patient_id = auth.uid() branch
-- was also the only thing giving patients direct SELECT access to this
-- table (016's own `patients_read_own_notes` isn't live either, for the
-- same undocumented reason) — restore that specifically, scoped to
-- SELECT only, matching 016's original documented intent. Provider
-- access is already fully covered by the existing, correctly-scoped
-- `providers_own_notes` policy (doctor profession only) — nothing else
-- needs to change.
-- ============================================================

DROP POLICY IF EXISTS clinical_notes_access ON clinical_notes;

DROP POLICY IF EXISTS patients_read_own_notes ON clinical_notes;
CREATE POLICY patients_read_own_notes ON clinical_notes
  FOR SELECT USING (patient_id = auth.uid());
