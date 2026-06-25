-- ============================================================
-- Migration 007: Haversine distance, live location dispatch
-- ============================================================

-- ============================================================
-- 1. HAVERSINE FUNCTION (pure SQL, no PostGIS required)
-- ============================================================

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r  constant double precision := 6371;
  dlat double precision := radians(lat2 - lat1);
  dlng double precision := radians(lng2 - lng1);
  a  double precision;
BEGIN
  a := sin(dlat / 2)^2
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2)^2;
  RETURN r * 2 * asin(sqrt(a));
END;
$$;

-- ============================================================
-- 2. UPDATED get_nearby_providers — returns haversine distance + ETA
--    (replaces original PostGIS-only version)
-- ============================================================

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat double precision,
  booking_lng double precision,
  radius_km    int default 15
)
RETURNS TABLE (
  provider_id  uuid,
  distance_km  double precision,
  eta_minutes  int
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    haversine_km(booking_lat, booking_lng, p.lat, p.lng)           AS distance_km,
    CEIL((haversine_km(booking_lat, booking_lng, p.lat, p.lng)
          / 20.0) * 60)::int                                        AS eta_minutes
  FROM providers p
  WHERE
    p.available           = true
    AND p.verification_status = 'verified'
    AND p.badge_issued    = true
    AND p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND haversine_km(booking_lat, booking_lng, p.lat, p.lng) <= radius_km
  ORDER BY distance_km ASC;
END;
$$;

-- ============================================================
-- 3. ACCEPT DISPATCH — atomic RPC called by provider client
--    Sets booking.status, booking.provider_id in one transaction
-- ============================================================

CREATE OR REPLACE FUNCTION accept_dispatch(p_dispatch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d RECORD;
BEGIN
  -- Verify this dispatch belongs to the calling provider and is still open
  SELECT dq.* INTO d
  FROM dispatch_queue dq
  WHERE dq.id = p_dispatch_id
    AND dq.response  IS NULL
    AND dq.expires_at > now()
    AND dq.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch not found, already responded, or expired';
  END IF;

  UPDATE dispatch_queue
  SET response = 'accepted', responded_at = now()
  WHERE id = p_dispatch_id;

  UPDATE bookings
  SET status      = 'accepted',
      accepted_at = now(),
      provider_id = d.provider_id
  WHERE id = d.booking_id
    AND status = 'pending';
END;
$$;

-- ============================================================
-- 4. UPDATED on_dispatch_declined — try next nearest provider
--    (replaces migration 006 version that just cancelled)
-- ============================================================

CREATE OR REPLACE FUNCTION on_dispatch_declined()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_provider_id uuid;
  b                RECORD;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id AND status = 'pending';
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Try the next nearest provider not already dispatched
  SELECT provider_id INTO next_provider_id
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15)
  WHERE provider_id NOT IN (
    SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = NEW.booking_id
  )
  LIMIT 1;

  IF next_provider_id IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.booking_id, next_provider_id, now(), now() + INTERVAL '2 minutes');
    UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = NEW.booking_id;
  ELSE
    -- No providers left in range
    UPDATE bookings SET status = 'cancelled', cancelled_at = now()
    WHERE id = NEW.booking_id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. UPDATED process_expired_dispatches — try next provider on expiry
--    (replaces migration 006 version that just cancelled)
-- ============================================================

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec              RECORD;
  next_provider_id uuid;
  expired_count    int;
BEGIN
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now() AND response IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Re-dispatch bookings whose last dispatch offer expired
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng
    FROM bookings b
    WHERE b.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_queue dq
        WHERE dq.booking_id = b.id AND dq.response IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM dispatch_queue dq
        WHERE dq.booking_id = b.id AND dq.response = 'expired'
      )
  LOOP
    SELECT provider_id INTO next_provider_id
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15)
    WHERE provider_id NOT IN (
      SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = rec.id
    )
    LIMIT 1;

    IF next_provider_id IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_provider_id, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = rec.id;
    ELSE
      UPDATE bookings SET status = 'cancelled', cancelled_at = now()
      WHERE id = rec.id AND status = 'pending';
    END IF;
  END LOOP;

  -- Rescue orphaned pending bookings (no dispatch at all — e.g. created before trigger existed,
  -- or initial dispatch found no available provider but one came online since)
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng
    FROM bookings b
    WHERE b.status = 'pending'
      AND b.created_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id
      )
  LOOP
    SELECT provider_id INTO next_provider_id
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15)
    LIMIT 1;

    IF next_provider_id IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_provider_id, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = 1 WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN expired_count;
END;
$$;

-- ============================================================
-- 6. INITIAL DISPATCH TRIGGER
--    Fires on booking INSERT (when provider_id is NULL = system dispatch)
--    and dispatches to the nearest available provider immediately
-- ============================================================

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
BEGIN
  -- Only auto-dispatch when no specific provider was pre-assigned
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

CREATE TRIGGER bookings_initial_dispatch
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION initial_booking_dispatch();