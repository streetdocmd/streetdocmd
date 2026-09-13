-- ============================================================
-- Migration 043: Patient-initiated medication orders
--
-- Until now, prescription_orders could only be created by a provider
-- transcribing a doctor's prescription during a visit (provider_id was
-- NOT NULL). A patient can now buy medication directly from the "Buy
-- Medication" service (no visit/prescription involved) — same pattern
-- as 024_patient_lab_investigation_requests.sql did for
-- investigation_orders.
--
-- No RLS change needed: rx_orders_access (014_pharmacy_drug_dispatch.sql)
-- is already `FOR ALL USING (patient_id = auth.uid() OR ...)`, so a
-- patient can already insert/read their own rows — provider_id's NOT
-- NULL constraint was the only actual blocker.
-- ============================================================

ALTER TABLE prescription_orders ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE prescription_orders ADD COLUMN IF NOT EXISTS requested_by text NOT NULL DEFAULT 'provider'
  CHECK (requested_by IN ('provider', 'patient'));
