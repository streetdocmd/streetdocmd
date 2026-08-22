-- ============================================================
-- Migration 024: Patient-initiated lab investigation requests
--
-- Until now, investigation_orders could only be created by a provider
-- during a clinical visit (provider_id was NOT NULL). Patients can now
-- request lab investigations directly from the "Request Lab
-- Investigations" entry point — either the curated wellness_check
-- package (unchanged: still a normal home-visit booking) or a custom
-- selection of tests dispatched straight to a lab partner, with no
-- provider or booking involved at all.
--
--   1. investigation_orders.provider_id becomes nullable — a
--      patient-requested order has no ordering provider.
--   2. investigation_orders.requested_by records who initiated the
--      order, so the lab portal and admin can tell the two apart.
--   3. A patient can now insert their own investigation_orders rows
--      directly (previously only provider/admin/lab_staff could write).
-- ============================================================

ALTER TABLE investigation_orders ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE investigation_orders ADD COLUMN IF NOT EXISTS requested_by text NOT NULL DEFAULT 'provider'
  CHECK (requested_by IN ('provider', 'patient'));

DROP POLICY IF EXISTS inv_orders_patient_insert ON investigation_orders;
CREATE POLICY inv_orders_patient_insert ON investigation_orders
  FOR INSERT WITH CHECK (patient_id = auth.uid() AND provider_id IS NULL);
