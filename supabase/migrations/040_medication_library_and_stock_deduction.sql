-- ============================================================
-- Migration 040: Medication library + inventory deduction on fulfillment
--
-- Two gaps closed:
--   1. Adding a new drug to a pharmacy's own catalogue meant typing every
--      field from scratch. `medication_library` is a platform-wide,
--      admin-curated reference list (name/generic/formulation/strength)
--      pharmacy staff search and pick from to prefill the add-drug form —
--      they still set their own price + stock_quantity, since those are
--      genuinely per-pharmacy. Same pattern as investigation_catalogue's
--      platform scope / streetdocmd_diagnoses' curated list.
--   2. Fulfilling a prescription_order never touched drug_catalogue.
--      stock_quantity at all — prescribing is free-text with no catalogue
--      link. This adds an optional `catalogue_id` field inside each
--      prescription_orders.drugs[] line (set by pharmacy staff when they
--      price the order, not by the prescriber, since only the fulfilling
--      pharmacy's own catalogue is a valid target) — application code
--      decrements stock_quantity when the order moves to "dispensing"
--      (the point stock is actually pulled, and the only point payment is
--      guaranteed to have cleared already).
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  generic_name text,
  formulation  text,
  strength     text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medication_library_name_idx ON medication_library(name);

ALTER TABLE medication_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_library_read" ON medication_library
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "medication_library_admin_all" ON medication_library
  FOR ALL USING (get_user_role() = 'admin');

-- Seed a starter library of common medications — admin can add more via
-- the same CRUD pattern as investigation_catalogue/wellness_packages.
INSERT INTO medication_library (name, generic_name, formulation, strength)
SELECT v.name, v.generic_name, v.formulation, v.strength
FROM (VALUES
  ('Paracetamol', 'Paracetamol', 'Tablet', '500mg'),
  ('Panadol Extra', 'Paracetamol/Caffeine', 'Tablet', '500mg/65mg'),
  ('Ibuprofen', 'Ibuprofen', 'Tablet', '400mg'),
  ('Diclofenac', 'Diclofenac Sodium', 'Tablet', '50mg'),
  ('Amoxicillin', 'Amoxicillin', 'Capsule', '500mg'),
  ('Augmentin', 'Amoxicillin/Clavulanate', 'Tablet', '625mg'),
  ('Ciprofloxacin', 'Ciprofloxacin', 'Tablet', '500mg'),
  ('Metronidazole', 'Metronidazole', 'Tablet', '400mg'),
  ('Azithromycin', 'Azithromycin', 'Tablet', '500mg'),
  ('Coartem', 'Artemether/Lumefantrine', 'Tablet', '80mg/480mg'),
  ('Fansidar', 'Sulfadoxine/Pyrimethamine', 'Tablet', '500mg/25mg'),
  ('Artesunate', 'Artesunate', 'Injection', '60mg'),
  ('Chloroquine', 'Chloroquine Phosphate', 'Tablet', '250mg'),
  ('Omeprazole', 'Omeprazole', 'Capsule', '20mg'),
  ('Ranitidine', 'Ranitidine', 'Tablet', '150mg'),
  ('Loperamide', 'Loperamide', 'Capsule', '2mg'),
  ('ORS', 'Oral Rehydration Salts', 'Sachet', 'Standard'),
  ('Zinc Sulphate', 'Zinc Sulphate', 'Tablet', '20mg'),
  ('Cetirizine', 'Cetirizine', 'Tablet', '10mg'),
  ('Loratadine', 'Loratadine', 'Tablet', '10mg'),
  ('Chlorpheniramine', 'Chlorpheniramine Maleate', 'Tablet', '4mg'),
  ('Piriton Syrup', 'Chlorpheniramine Maleate', 'Syrup', '2mg/5ml'),
  ('Salbutamol Inhaler', 'Salbutamol', 'Inhaler', '100mcg'),
  ('Amlodipine', 'Amlodipine', 'Tablet', '5mg'),
  ('Lisinopril', 'Lisinopril', 'Tablet', '10mg'),
  ('Losartan', 'Losartan Potassium', 'Tablet', '50mg'),
  ('Metformin', 'Metformin', 'Tablet', '500mg'),
  ('Glibenclamide', 'Glibenclamide', 'Tablet', '5mg'),
  ('Atorvastatin', 'Atorvastatin', 'Tablet', '20mg'),
  ('Vitamin C', 'Ascorbic Acid', 'Tablet', '1000mg'),
  ('Multivitamin', 'Multivitamin', 'Tablet', 'Standard'),
  ('Folic Acid', 'Folic Acid', 'Tablet', '5mg'),
  ('Ferrous Sulphate', 'Ferrous Sulphate', 'Tablet', '200mg'),
  ('Hydrocortisone Cream', 'Hydrocortisone', 'Cream', '1%'),
  ('Fusidic Acid Cream', 'Fusidic Acid', 'Cream', '2%'),
  ('Tramadol', 'Tramadol', 'Capsule', '50mg'),
  ('Diazepam', 'Diazepam', 'Tablet', '5mg'),
  ('Amitriptyline', 'Amitriptyline', 'Tablet', '25mg'),
  ('Prednisolone', 'Prednisolone', 'Tablet', '5mg'),
  ('Insulin (Soluble)', 'Human Insulin', 'Injection', '100IU/ml'),
  ('Artemether Injection', 'Artemether', 'Injection', '80mg/ml')
) AS v(name, generic_name, formulation, strength)
WHERE NOT EXISTS (SELECT 1 FROM medication_library WHERE name = v.name);
