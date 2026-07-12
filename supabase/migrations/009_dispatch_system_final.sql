-- ============================================================
-- StreetdocMD — Dispatch System (run this once in Supabase SQL Editor)
-- Safe to re-run: all statements are idempotent.
--
-- What this does:
--   1. Distance function (no PostGIS required)
--   2. get_nearby_providers() — finds available verified providers near a point
--   3. initial_booking_dispatch trigger — fires the moment a booking is created,
--      immediately dispatches to the nearest provider
--   4. on_dispatch_declined trigger — when provider declines, instantly routes
--      to the next nearest provider (or cancels if none left)
--   5. accept_dispatch() RPC — atomic accept used by the provider app
--   6. process_expired_dispatches() — called every minute; moves expired offers
--      to the next provider, or cancels if no one is left
--   7. pg_cron job — runs #6 automatically every minute
-- ============================================================

-- ── 1. HAVERSINE DISTANCE ────────────────────────────────────

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r    constant double precision := 6371;
  dlat double precision := radians(lat2 - lat1);
  dlng double precision := radians(lng2 - lng1);
  a    double precision;
BEGIN
  a := sin(dlat / 2)^2
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2)^2;
  RETURN r * 2 * asin(sqrt(a));
END;
$$;

-- ── 2. GET NEARBY PROVIDERS ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat double precision,
  booking_lng double precision,
  radius_km   int DEFAULT 15
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
  ORDER BY distance_km ASC;
END;
$$;

-- ── 3. INITIAL DISPATCH TRIGGER ──────────────────────────────
-- Fires the instant a booking is inserted; creates a 2-minute dispatch offer
-- for the nearest available verified provider.

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
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION initial_booking_dispatch();

-- ── 4. ON DECLINE: ROUTE TO NEXT PROVIDER ───────────────────
-- When a provider declines, immediately dispatch to the next nearest provider
-- who hasn't already been tried. If no one left, cancel the booking.

CREATE OR REPLACE FUNCTION on_dispatch_declined()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_prov uuid;
  b         RECORD;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id AND status = 'pending';
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
    WHERE id = NEW.booking_id AND status = 'pending';
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

-- ── 5. ACCEPT DISPATCH RPC ───────────────────────────────────
-- Atomic: marks offer accepted + sets booking.provider_id + booking.status in one transaction.

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
  WHERE id = d.booking_id AND status = 'pending';
END;
$$;

-- ── 6. PROCESS EXPIRED DISPATCHES (called by pg_cron) ────────
-- Marks timed-out offers expired, then routes each affected booking to the
-- next nearest untried provider — or cancels if none left in range.
-- Also rescues orphaned pending bookings that somehow have no dispatch entry.

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

  -- For each pending booking whose last offer just expired, try next provider
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng
    FROM bookings b
    WHERE b.status = 'pending'
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
      WHERE id = rec.id AND status = 'pending';
    END IF;
  END LOOP;

  -- Rescue orphaned pending bookings (no dispatch entry at all, older than 2 min)
  -- Catches edge cases where initial trigger fired but found no provider, but one came online since
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng
    FROM bookings b
    WHERE b.status    = 'pending'
      AND b.created_at < now() - INTERVAL '2 minutes'
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

-- ── 7. PG_CRON: run every minute ─────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN PERFORM cron.unschedule('expire-dispatch-queue');  EXCEPTION WHEN OTHERS THEN NULL; END; $$;
DO $$ BEGIN PERFORM cron.unschedule('expire-dispatch-offers'); EXCEPTION WHEN OTHERS THEN NULL; END; $$;

SELECT cron.schedule(
  'expire-dispatch-queue',
  '* * * * *',
  'SELECT process_expired_dispatches()'
);