-- ============================================================
-- Migration 063: lab test preparation and dated prices
--
-- The lab price list (design: catalogue, testform) shows each test's
-- preparation for the patient and when its price last changed.
--
--   investigation_catalogue.preparation       shown to patients before they book
--   investigation_catalogue.price_updated_at  set whenever the price changes
-- ============================================================

ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS preparation text;
ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;

UPDATE investigation_catalogue SET price_updated_at = created_at WHERE price_updated_at IS NULL;

ALTER TABLE investigation_catalogue ALTER COLUMN price_updated_at SET DEFAULT now();
ALTER TABLE investigation_catalogue ALTER COLUMN price_updated_at SET NOT NULL;
