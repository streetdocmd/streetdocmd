-- ============================================================
-- Migration 023: Service -> specialty dispatch filtering
--
-- Providers now only receive dispatch offers that match their specialty:
--   wound_care, nursing_care             -> Registered Nurse
--   general_consultation, elderly_review -> Medical Doctor (General/Specialist)
--   physiotherapy                        -> Physiotherapist
--   (every other service_type stays unrestricted)
--
-- Also adds `physiotherapy` as a bookable service_type, and a
-- follow_up_of_booking_id link + RPC so a provider can request a nurse
-- follow-up visit for a patient after an elderly_review consultation.
-- ============================================================

-- ── 1. SERVICE -> SPECIALTY MAP ──────────────────────────────
-- Keep in sync with SERVICE_TO_SPECIALTY in packages/shared/src/constants/index.ts
-- (that copy is for UI copy only — this function is the enforcement source of truth).

CREATE OR REPLACE FUNCTION service_allowed_specialties(p_service_type text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_service_type
    WHEN 'wound_care'           THEN ARRAY['Registered Nurse']
    WHEN 'nursing_care'         THEN ARRAY['Registered Nurse']
    WHEN 'general_consultation' THEN ARRAY['Medical Doctor (General)', 'Medical Doctor (Specialist)']
    WHEN 'elderly_review'       THEN ARRAY['Medical Doctor (General)', 'Medical Doctor (Specialist)']
    WHEN 'physiotherapy'        THEN ARRAY['Physiotherapist']
    ELSE NULL
  END;
$$;

-- ── 2. GET_NEARBY_PROVIDERS: add optional specialty filter ──
-- Backward compatible: every existing 3-arg call site (lat, lng, radius_km) keeps working.

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat double precision,
  booking_lng double precision,
  radius_km   int DEFAULT 15,
  specialties text[] DEFAULT NULL
)
RETURNS TABLE (
  provider_id uuid,
  distance_km double precision,
  eta_minutes int
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    haversine_km(booking_lat, booking_lng, p.lat, p.lng)        AS distance_km,
    CEIL((haversine_km(booking_lat, booking_lng, p.lat, p.lng)
          / 20.0) * 60)::int                                    AS eta_minutes
  FROM providers p
  WHERE
    p.available              = true
    AND p.verification_status = 'verified'
    AND p.badge_issued        = true
    AND p.lat                IS NOT NULL
    AND p.lng                IS NOT NULL
    AND haversine_km(booking_lat, booking_lng, p.lat, p.lng) <= radius_km
    AND (specialties IS NULL OR p.specialty = ANY(specialties))
  ORDER BY distance_km ASC;
END;
$$;

-- ── 3. SINGLE CALLABLE FOR "WHO CAN SERVE THIS BOOKING" ──────
-- Keeps specialty-matching server-side rather than trusting client-computed filters.

CREATE OR REPLACE FUNCTION get_eligible_providers_for_service(
  booking_lat    double precision,
  booking_lng    double precision,
  p_service_type text,
  radius_km      int DEFAULT 15
)
RETURNS TABLE (
  provider_id uuid,
  distance_km double precision,
  eta_minutes int
)
LANGUAGE sql AS $$
  SELECT * FROM get_nearby_providers(
    booking_lat, booking_lng, radius_km, service_allowed_specialties(p_service_type)
  );
$$;

-- ── 4. DISPATCH PIPELINE: apply the specialty filter ─────────
-- Same bodies as migration 019, with service_allowed_specialties(service_type)
-- threaded into every get_nearby_providers() call.

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
BEGIN
  IF NEW.provider_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT provider_id INTO nearest
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15, service_allowed_specialties(NEW.service_type))
  LIMIT 1;

  IF nearest IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.id, nearest, now(), now() + INTERVAL '2 minutes');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_initial_dispatch ON bookings;
CREATE TRIGGER bookings_initial_dispatch
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status = 'pending_payment' AND NEW.status = 'paid')
  EXECUTE FUNCTION initial_booking_dispatch();

CREATE OR REPLACE FUNCTION on_dispatch_declined()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_prov uuid;
  b         RECORD;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id AND status = 'paid';
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT provider_id INTO next_prov
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, service_allowed_specialties(b.service_type))
  WHERE provider_id NOT IN (
    SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = NEW.booking_id
  )
  LIMIT 1;

  IF next_prov IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.booking_id, next_prov, now(), now() + INTERVAL '2 minutes');
    UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = NEW.booking_id;
  ELSE
    UPDATE bookings SET status = 'cancelled', cancelled_at = now()
    WHERE id = NEW.booking_id AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_queue_on_decline ON dispatch_queue;
CREATE TRIGGER dispatch_queue_on_decline
  AFTER UPDATE ON dispatch_queue
  FOR EACH ROW
  WHEN (OLD.response IS NULL AND NEW.response = 'declined')
  EXECUTE FUNCTION on_dispatch_declined();

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec           RECORD;
  next_prov     uuid;
  expired_count int;
BEGIN
  -- Mark all timed-out open offers as expired
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now() AND response IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- For each paid booking whose last offer just expired, try next provider
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.service_type
    FROM bookings b
    WHERE b.status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response = 'expired'
      )
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, service_allowed_specialties(rec.service_type))
    WHERE provider_id NOT IN (
      SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = rec.id
    )
    LIMIT 1;

    IF next_prov IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_prov, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = rec.id;
    ELSE
      UPDATE bookings SET status = 'cancelled', cancelled_at = now()
      WHERE id = rec.id AND status = 'paid';
    END IF;
  END LOOP;

  -- Rescue orphaned paid bookings (no dispatch entry at all, older than 2 min)
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.service_type
    FROM bookings b
    WHERE b.status    = 'paid'
      AND b.updated_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id)
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, service_allowed_specialties(rec.service_type))
    LIMIT 1;

    IF next_prov IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_prov, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = 1 WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN expired_count;
END;
$$;

-- ── 5. NEW SERVICE TYPE: physiotherapy ────────────────────────

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check CHECK (service_type IN (
  'general_consultation', 'wellness_check', 'wound_care', 'elderly_review',
  'nursing_care', 'physiotherapy', 'custom_request'
));

-- ── 6. ELDERLY-REVIEW -> NURSE FOLLOW-UP HANDOFF ─────────────

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
