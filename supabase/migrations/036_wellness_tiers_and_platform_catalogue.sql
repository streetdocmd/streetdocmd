-- ============================================================
-- Migration 036: Wellness Check tiers + platform-wide test catalogue
--
-- Splits the two lab-investigation entry points apart from each other:
--   1. Wellness Check currently books as a single flat-price generic
--      service_type ("wellness_check" in bookings, dispatched as a normal
--      home visit). This adds admin-managed tiered packages
--      (Basic/Gold/Platinum) that a patient picks between — the booking
--      mechanism itself (bookings row, dispatch, payment) is unchanged,
--      only the price and included-tests snapshot now come from the
--      chosen package instead of a flat SERVICE_PRICES lookup.
--   2. "Choose Specific Tests" (migration 013/024) currently reads from
--      investigation_catalogue scoped to whichever lab partner the page
--      picks first — there's no actual patient-facing, platform-wide
--      list. This adds a scope column so a subset of the catalogue can
--      be platform-wide (no specific lab_partner_id) while
--      provider-ordered/lab-partner-owned catalogue rows are unaffected.
-- ============================================================

-- ── 1. WELLNESS PACKAGES (admin-managed tiers) ────────────────

CREATE TABLE IF NOT EXISTS wellness_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  price          numeric(10,2) NOT NULL,
  description    text,
  -- same shape as investigation_orders.tests: [{test_name, test_code?}]
  included_tests jsonb NOT NULL DEFAULT '[]',
  sort_order     int NOT NULL DEFAULT 0,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wellness_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_packages_read" ON wellness_packages
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "wellness_packages_admin_all" ON wellness_packages
  FOR ALL USING (get_user_role() = 'admin');

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wellness_package_id uuid REFERENCES wellness_packages(id);

-- Placeholder tiers — admin can edit/replace via the Labs dashboard.
INSERT INTO wellness_packages (name, price, description, included_tests, sort_order)
SELECT 'Basic', 8000, 'Essential screening for a general health check',
  '[{"test_name":"Full Blood Count"},{"test_name":"Fasting Blood Sugar"},{"test_name":"Urinalysis"}]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM wellness_packages WHERE name = 'Basic');

INSERT INTO wellness_packages (name, price, description, included_tests, sort_order)
SELECT 'Gold', 18000, 'A broader panel covering common chronic-disease markers',
  '[{"test_name":"Full Blood Count"},{"test_name":"Fasting Blood Sugar"},{"test_name":"Lipid Profile"},{"test_name":"Liver Function Test"},{"test_name":"Kidney Function Test"},{"test_name":"Urinalysis"}]'::jsonb, 2
WHERE NOT EXISTS (SELECT 1 FROM wellness_packages WHERE name = 'Gold');

INSERT INTO wellness_packages (name, price, description, included_tests, sort_order)
SELECT 'Platinum', 32000, 'Comprehensive annual screening, including infectious disease and cancer markers',
  '[{"test_name":"Full Blood Count"},{"test_name":"Fasting Blood Sugar"},{"test_name":"Lipid Profile"},{"test_name":"Liver Function Test"},{"test_name":"Kidney Function Test"},{"test_name":"Urinalysis"},{"test_name":"HIV Screening"},{"test_name":"Hepatitis B Screening"},{"test_name":"Thyroid Function Test"}]'::jsonb, 3
WHERE NOT EXISTS (SELECT 1 FROM wellness_packages WHERE name = 'Platinum');

-- ── 2. PLATFORM-WIDE TEST CATALOGUE (for "Select Lab Tests") ─
-- investigation_catalogue rows were previously always scoped to one
-- lab_partner (a provider building an order during a visit, or a lab
-- partner's own menu). "platform" rows are patient-facing and not tied
-- to a partner until an order is placed (the order route resolves a
-- fulfilling partner separately, same as it already did before this).

ALTER TABLE investigation_catalogue ALTER COLUMN lab_partner_id DROP NOT NULL;
ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'lab_partner'
  CHECK (scope IN ('lab_partner', 'platform'));

-- Placeholder platform catalogue — admin can edit/replace via the Labs dashboard.
INSERT INTO investigation_catalogue (lab_partner_id, test_name, test_code, price, turnaround_hours, sample_type, home_collection, scope)
SELECT NULL, t.name, t.code, t.price, t.hours, t.sample, true, 'platform'
FROM (VALUES
  ('Full Blood Count', 'FBC', 4000, 24, 'Blood'),
  ('Malaria Parasite Test', 'MP', 2500, 6, 'Blood'),
  ('Widal Test (Typhoid)', 'WIDAL', 3000, 24, 'Blood'),
  ('Fasting Blood Sugar', 'FBS', 2000, 6, 'Blood'),
  ('Lipid Profile', 'LIPID', 8000, 24, 'Blood'),
  ('Liver Function Test', 'LFT', 9000, 24, 'Blood'),
  ('Kidney Function Test', 'KFT', 9000, 24, 'Blood'),
  ('Urinalysis', 'UA', 2000, 4, 'Urine'),
  ('HIV Screening', 'HIV', 5000, 24, 'Blood'),
  ('Hepatitis B Screening', 'HBV', 5000, 24, 'Blood'),
  ('Thyroid Function Test', 'TFT', 12000, 48, 'Blood')
) AS t(name, code, price, hours, sample)
WHERE NOT EXISTS (
  SELECT 1 FROM investigation_catalogue WHERE scope = 'platform' AND test_name = t.name
);
