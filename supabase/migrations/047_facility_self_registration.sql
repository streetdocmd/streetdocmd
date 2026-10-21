-- ============================================================
-- Migration 047: Facility self-registration accounts + approval fixes
--
-- Facilities (labs, pharmacies, hospitals) now create their portal login
-- when they register, and land on their partner portal straight away
-- (it shows "application under review" until approved). Approval links
-- the partner record to that existing login instead of creating a new
-- auth user — creating one failed whenever the email already had an
-- account, which surfaced as the approval error.
--
--   1. facility_applications.user_id — the login created at registration
--   2. users_role_check — add hospital_staff. Approving a hospital wrote
--      role 'hospital_staff', which the check from 014 rejects.
--      NOT VALID: only new/updated rows are checked, so this can't fail on
--      any existing row whose role predates this list.
-- ============================================================

ALTER TABLE facility_applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS facility_applications_user_id_idx ON facility_applications(user_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'provider', 'admin', 'lab_staff', 'pharmacy_staff', 'hospital_staff')) NOT VALID;
