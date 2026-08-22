-- ============================================================
-- Migration 019: Payment-gated dispatch
--
-- Bookings and prescription orders must never be visible/dispatchable
-- to providers or pharmacy until payment is server-side confirmed
-- (by the Paystack webhook). This migration:
--   1. Extends bookings.status with 'pending_payment' / 'paid' / 'expired'
--      and backfills existing 'pending' rows to 'paid' (pre-launch data).
--   2. Extends prescription_orders.status with 'expired'.
--   3. Moves the dispatch trigger from AFTER INSERT to AFTER UPDATE,
--      firing only on the pending_payment -> paid transition.
--   4. Renames every 'pending' status check in the dispatch pipeline to
--      'paid' (pure rename — 'paid' now plays the role 'pending' used to).
--   5. Adds expire_abandoned_payments(), scheduled every 5 minutes, which
--      flips stale pending_payment rows to 'expired' without deleting them.
-- ============================================================

-- ── 1. BOOKINGS.STATUS ───────────────────────────────────────

UPDATE bookings SET status = 'paid' WHERE status = 'pending';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'pending_payment', 'paid', 'accepted', 'en_route', 'arrived',
  'in_progress', 'completed', 'cancelled', 'expired'
));

ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'pending_payment';

-- ── 2. PRESCRIPTION_ORDERS.STATUS ────────────────────────────

ALTER TABLE prescription_orders DROP CONSTRAINT IF EXISTS prescription_orders_status_check;
ALTER TABLE prescription_orders ADD CONSTRAINT prescription_orders_status_check CHECK (status IN (
  'pending_payment', 'sent', 'confirmed',
  'dispensing', 'dispatched', 'delivered', 'cancelled', 'expired'
));

-- ── 3. DISPATCH TRIGGER: fire on paid transition, not insert ────

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
BEGIN
  IF NEW.provider_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT provider_id INTO nearest
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15)
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

-- ── 4. RENAME 'pending' -> 'paid' IN DISPATCH PIPELINE ───────

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
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15)
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

CREATE OR REPLACE FUNCTION accept_dispatch(p_dispatch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d RECORD;
BEGIN
  SELECT dq.* INTO d
  FROM dispatch_queue dq
  WHERE dq.id           = p_dispatch_id
    AND dq.response    IS NULL
    AND dq.expires_at   > now()
    AND dq.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found, already responded, or expired';
  END IF;

  UPDATE dispatch_queue
  SET response = 'accepted', responded_at = now()
  WHERE id = p_dispatch_id;

  UPDATE bookings
  SET status      = 'accepted',
      accepted_at = now(),
      provider_id = d.provider_id
  WHERE id = d.booking_id AND status = 'paid';
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
  -- Mark all timed-out open offers as expired
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now() AND response IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- For each paid booking whose last offer just expired, try next provider
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng
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
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15)
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
    SELECT b.id, b.patient_lat, b.patient_lng
    FROM bookings b
    WHERE b.status    = 'paid'
      AND b.updated_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id)
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15)
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

-- ── 5. EXPIRE ABANDONED PAYMENTS ─────────────────────────────
-- Bookings/orders left at pending_payment past the abandonment window are
-- marked 'expired', never deleted — patient contact info stays available
-- to admins for follow-up (e.g. abandoned-checkout campaigns).

CREATE OR REPLACE FUNCTION expire_abandoned_payments()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET status = 'expired'
  WHERE status = 'pending_payment' AND created_at < now() - INTERVAL '30 minutes';

  UPDATE prescription_orders
  SET status = 'expired'
  WHERE status = 'pending_payment' AND created_at < now() - INTERVAL '30 minutes';
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN PERFORM cron.unschedule('expire-abandoned-payments'); EXCEPTION WHEN OTHERS THEN NULL; END; $$;

SELECT cron.schedule(
  'expire-abandoned-payments',
  '*/5 * * * *',
  'SELECT expire_abandoned_payments()'
);
