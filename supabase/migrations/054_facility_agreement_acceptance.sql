-- ============================================================
-- Migration 054: Facility Partner Platform Service Agreement acceptance
--
-- The Facility Partner Platform Service Agreement (cl. 2.2–2.6, 2.8 and the
-- Platform Acceptance Screen) requires StreetdocMD to record, for every
-- facility, which version of the Agreement was accepted, when (system
-- timestamp), and by which user / authorised representative. The other
-- sign-up particulars (legal name, RC/BN = cac_number, facility type, email,
-- phone, address) already live on facility_applications.
--
--   agreement_version        the FACILITY_AGREEMENT.version accepted (e.g. '2')
--   agreement_accepted_at    server time of acceptance
--   agreement_accepted_by    the portal login (auth user id) that accepted
--   agreement_accepted_name  name of the authorised representative who accepted
--
-- Written only by the service role: POST /api/facility/apply (at sign-up) and
-- POST /api/facility/agreement (facilities registered before this change, or
-- re-acceptance after a new version). No RLS policy changes.
--
-- agreement_accepted_by deliberately has no foreign key: the acceptance record
-- must survive even if the login is later deleted.
--
-- Additive and idempotent.
-- ============================================================

ALTER TABLE facility_applications
  ADD COLUMN IF NOT EXISTS agreement_version       text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_accepted_by   uuid,
  ADD COLUMN IF NOT EXISTS agreement_accepted_name text;

COMMENT ON COLUMN facility_applications.agreement_version       IS 'Facility Partner Platform Service Agreement version accepted';
COMMENT ON COLUMN facility_applications.agreement_accepted_at   IS 'Server timestamp of the electronic acceptance';
COMMENT ON COLUMN facility_applications.agreement_accepted_by   IS 'Auth user (portal login) that accepted the Agreement';
COMMENT ON COLUMN facility_applications.agreement_accepted_name IS 'Name of the authorised representative who accepted';
