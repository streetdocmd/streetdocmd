-- ============================================================
-- Migration 020: Generalized practitioner credential fields
--
-- Individual (home-visit) providers currently verify against two
-- hardcoded columns, mdcn_number and nmcn_number — meaning only doctors
-- and nurses can ever have a credential checked, no matter what other
-- specialties are offered at registration. This migration:
--   1. Adds generic license_body / license_number columns and backfills
--      them from the existing mdcn_number / nmcn_number values. The old
--      columns are left in place (not dropped) — nothing reads them after
--      this migration, but keeping them costs nothing and avoids any risk
--      of losing data if this needs to be rolled back.
--   2. Extends provider_documents.document_type with mrtb_licence
--      (physiotherapists) and mlscn_licence (medical laboratory
--      scientists / lab technicians), alongside the existing
--      mdcn_licence / nmcn_licence.
--   3. Adds providers.hospital_partner_id — groundwork for hospital-
--      affiliated providers (e.g. an affiliated physiotherapist), who
--      keep their own individually-dispatched provider record but are
--      linked to a hospital for that hospital's own reporting. Nothing
--      writes to this column yet; it's additive groundwork only.
-- ============================================================

-- ── 1. GENERIC LICENSE FIELDS ────────────────────────────────

ALTER TABLE providers ADD COLUMN IF NOT EXISTS license_body text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS license_number text;

UPDATE providers SET license_body = 'MDCN', license_number = mdcn_number
  WHERE mdcn_number IS NOT NULL AND license_number IS NULL;

UPDATE providers SET license_body = 'NMCN', license_number = nmcn_number
  WHERE nmcn_number IS NOT NULL AND license_number IS NULL;

-- ── 2. NEW LICENCE DOCUMENT TYPES ────────────────────────────

ALTER TABLE provider_documents DROP CONSTRAINT IF EXISTS provider_documents_document_type_check;
ALTER TABLE provider_documents ADD CONSTRAINT provider_documents_document_type_check
  CHECK (document_type IN (
    'mdcn_licence', 'nmcn_licence', 'mrtb_licence', 'mlscn_licence',
    'nin', 'passport', 'certificate'
  ));

-- ── 3. HOSPITAL AFFILIATION (groundwork only) ────────────────

ALTER TABLE providers ADD COLUMN IF NOT EXISTS hospital_partner_id uuid REFERENCES hospital_partners(id);
