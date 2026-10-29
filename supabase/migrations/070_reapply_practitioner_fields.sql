-- ============================================================
-- Migration 070: Re-apply 020 and 021 on databases that skipped them
--
-- The live database lists 020_practitioner_taxonomy and
-- 021_specialist_field as applied, but neither ran: providers has no
-- license_body, license_number, specialist_field or hospital_partner_id,
-- and provider_documents still rejects mrtb_licence / mlscn_licence.
-- Every provider registration failed on the providers insert
-- ("Could not find the 'license_body' column"), and physiotherapists
-- could not upload their MRTB licence.
--
-- Everything here is idempotent, so it is a no-op where 020/021 did run.
-- ============================================================

ALTER TABLE providers ADD COLUMN IF NOT EXISTS license_body text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialist_field text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS hospital_partner_id uuid REFERENCES hospital_partners(id);

-- Older rows carried the licence in mdcn_number
UPDATE providers SET license_body = 'MDCN', license_number = mdcn_number
  WHERE mdcn_number IS NOT NULL AND license_number IS NULL;

ALTER TABLE provider_documents DROP CONSTRAINT IF EXISTS provider_documents_document_type_check;
ALTER TABLE provider_documents ADD CONSTRAINT provider_documents_document_type_check
  CHECK (document_type IN (
    'mdcn_licence', 'nmcn_licence', 'mrtb_licence', 'mlscn_licence',
    'nin', 'passport', 'certificate'
  ));

-- PostgREST caches the schema; make the new columns visible straight away
NOTIFY pgrst, 'reload schema';
