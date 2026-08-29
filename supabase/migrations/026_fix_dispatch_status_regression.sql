-- ============================================================
-- Migration 026: Fix a status-semantics regression introduced by 023
--
-- Migration 019 (payment-gated dispatch) changed the dispatch pipeline's
-- bookings.status values from 'pending' to 'pending_payment' -> 'paid',
-- and updated on_dispatch_declined() and process_expired_dispatches()
-- accordingly (status = 'paid' instead of 'pending'; the orphan-rescue
-- loop keying off b.updated_at instead of b.created_at).
--
-- Migration 023 (provider-agnostic platform) added a profession filter to
-- the dispatch pipeline via CREATE OR REPLACE FUNCTION on all three
-- dispatch functions, but the versions it replaced them with were copied
-- from the pre-019 file (009_dispatch_system_final.sql) rather than from
-- 019's corrected versions — silently reverting 019's status fix inside
-- on_dispatch_declined() and process_expired_dispatches(). Since neither
-- function ever matched a real booking again (bookings are never actually
-- 'pending' post-019), a declined or expired dispatch offer would just
-- silently stop being retried, for every profession, not just nurse/physio
-- — this broke existing behaviour, caught by live-testing before Pass 2.
--
-- This restores 019's status semantics ('paid', b.updated_at) while
-- keeping 023's profession filter. initial_booking_dispatch() is
-- unaffected — it never checked status in its body either before or
-- after 023 (gating happens via the trigger's WHEN clause, which this
-- migration does not touch), so it needs no fix here.
-- ============================================================

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
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, b.profession)
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

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec           RECORD;
  next_prov     uuid;
  expired_count int;
BEGIN
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now() AND response IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
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
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession)
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

  -- Rescue orphaned paid bookings (no dispatch entry at all, older than 2
  -- min) — keyed off updated_at, matching 019: a booking's updated_at
  -- moves to "now" the moment it transitions pending_payment -> paid, so
  -- this correctly measures time-since-paid rather than time-since-created.
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
    FROM bookings b
    WHERE b.status    = 'paid'
      AND b.updated_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id)
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession)
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
