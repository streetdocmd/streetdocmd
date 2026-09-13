-- ============================================================
-- Migration 045: Seed a placeholder pharmacy partner + catalogue
--
-- pharmacy_partners was completely empty in this database — despite the
-- admin inventory UI, pharmacy-portal, and now the patient "Buy
-- Medication" flow all assuming at least one exists. Same placeholder
-- pattern as 036_wellness_tiers_and_platform_catalogue.sql (wellness
-- packages / platform lab catalogue): real rows, clearly a stand-in for
-- product owner to replace with the actual onboarded pharmacy partner(s).
-- Coordinates are central Lagos (Ikeja), matching this codebase's other
-- Lagos-based seed/test data.
--
-- Mix of prescription_required true/false so the patient-facing "Buy
-- Medication" flow (which only lists prescription_required = false)
-- demonstrably excludes some real rows, not just an empty table.
-- ============================================================

INSERT INTO pharmacy_partners (name, address, lat, lng, phone, email, delivery_radius_km, active)
SELECT 'StreetdocMD Partner Pharmacy — Ikeja', 'Awolowo Road, Ikeja, Lagos', 6.6018, 3.3515,
       '+2348000000000', 'pharmacy@streetdocmd.com', 15, true
WHERE NOT EXISTS (SELECT 1 FROM pharmacy_partners WHERE name = 'StreetdocMD Partner Pharmacy — Ikeja');

INSERT INTO drug_catalogue (pharmacy_partner_id, drug_name, generic_name, formulation, strength, price, prescription_required, in_stock, active, stock_quantity)
SELECT p.id, t.name, t.generic, t.form, t.strength, t.price, t.rx, true, true, t.stock
FROM pharmacy_partners p,
(VALUES
  ('Paracetamol',        'Paracetamol',   'Tablet', '500mg',      500,  false, 200),
  ('Ibuprofen',          'Ibuprofen',     'Tablet', '400mg',      800,  false, 150),
  ('Oral Rehydration Salts (ORS)', 'ORS', 'Sachet', 'Standard',   350,  false, 100),
  ('Vitamin C',          'Ascorbic Acid', 'Tablet', '1000mg',     1200, false, 120),
  ('Multivitamin',       'Multivitamin',  'Tablet', 'Standard',   1500, false, 100),
  ('Antacid Suspension', 'Magnesium/Aluminium Hydroxide', 'Syrup', '200ml', 1800, false, 60),
  ('Cough Syrup',        'Dextromethorphan', 'Syrup', '100ml',    2000, false, 80),
  ('Amoxicillin',        'Amoxicillin',   'Capsule', '500mg',     2500, true,  50),
  ('Ciprofloxacin',      'Ciprofloxacin', 'Tablet', '500mg',      3000, true,  40),
  ('Artemether/Lumefantrine (Antimalarial)', 'Artemether/Lumefantrine', 'Tablet', '20/120mg', 2800, true, 60)
) AS t(name, generic, form, strength, price, rx, stock)
WHERE p.name = 'StreetdocMD Partner Pharmacy — Ikeja'
  AND NOT EXISTS (
    SELECT 1 FROM drug_catalogue dc WHERE dc.pharmacy_partner_id = p.id AND dc.drug_name = t.name
  );
