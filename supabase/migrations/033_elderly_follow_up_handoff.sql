-- ============================================================
-- Migration 033: Elderly-review -> nurse follow-up handoff
--
-- Extracted from a parallel branch's migration 023, which also tried to
-- redefine get_nearby_providers()/dispatch around a specialty-array model.
-- That part is NOT applied here — it would regress the profession-based
-- dispatch system shipped in 023_provider_agnostic_platform.sql and later
-- migrations. Only the additive, non-conflicting piece is kept: a provider
-- who saw a patient for an elderly_review visit can create a linked
-- nursing_care follow-up booking for that patient.
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS follow_up_of_booking_id uuid REFERENCES bookings(id);
CREATE INDEX IF NOT EXISTS bookings_follow_up_idx ON bookings(follow_up_of_booking_id);

-- Creates a new pending_payment nursing_care booking linked back to the
-- original elderly_review visit, and queues a patient SMS asking them to
-- confirm and pay so the follow-up gets dispatched (keeps the same
-- payment-gates-dispatch invariant every other booking relies on).
-- p_fee/p_commission/p_net_payout are computed by the caller from
-- SERVICE_PRICES.nursing_care (packages/shared/src/constants/index.ts) —
-- same trust boundary already used by every other booking-creation path
-- in this codebase (fee is never computed in SQL).
CREATE OR REPLACE FUNCTION create_elderly_follow_up_booking(
  p_original_booking_id uuid,
  p_fee numeric,
  p_commission numeric,
  p_net_payout numeric
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  orig RECORD;
  v_new_id uuid;
BEGIN
  SELECT * INTO orig FROM bookings WHERE id = p_original_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF orig.service_type <> 'elderly_review' THEN
    RAISE EXCEPTION 'Follow-up requests are only available for elderly review visits';
  END IF;

  IF orig.provider_id IS NULL
     OR orig.provider_id NOT IN (SELECT id FROM providers WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the provider who saw this patient can request a follow-up';
  END IF;

  INSERT INTO bookings (
    patient_id, family_member_id, service_type, status,
    patient_lat, patient_lng, patient_address, notes,
    fee, commission, net_payout, payment_status,
    follow_up_of_booking_id
  ) VALUES (
    orig.patient_id, orig.family_member_id, 'nursing_care', 'pending_payment',
    orig.patient_lat, orig.patient_lng, orig.patient_address,
    'Nurse follow-up requested after elderly review visit',
    p_fee, p_commission, p_net_payout, 'pending',
    orig.id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO notifications_queue (patient_id, message, send_at, type)
  VALUES (
    orig.patient_id,
    'Your doctor has recommended a follow-up nurse visit. Please confirm and complete payment in the app to schedule it.',
    now(),
    'follow_up_care'
  );

  RETURN v_new_id;
END;
$$;
