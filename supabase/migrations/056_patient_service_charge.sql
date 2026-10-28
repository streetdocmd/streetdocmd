-- ============================================================
-- Migration 056: Patient service charge
--
-- Patients pay the provider's visit fee plus a platform service charge
-- (Patient Terms v2.0). The charge is stored per booking so the amount a
-- patient was quoted never changes afterwards, and the rate lives in
-- platform_settings so it can be changed without a deploy.
--
--   total the patient pays = bookings.fee + bookings.service_charge
--
-- bookings.fee, commission and net_payout keep their current meaning
-- (provider fee, 20% commission on it, provider payout). Existing bookings
-- get service_charge = 0, so nothing already priced or paid changes.
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_charge numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.service_charge IS
  'Platform service charge paid by the patient on top of fee. Total paid = fee + service_charge.';

INSERT INTO platform_settings (key, value, description)
VALUES ('patient_service_charge_rate', to_jsonb(0.05),
        'Service charge added to the visit fee and paid by the patient, as a fraction (0.05 = 5%).')
ON CONFLICT (key) DO NOTHING;
