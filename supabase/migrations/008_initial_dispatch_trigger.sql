-- ============================================================
-- Migration 008: Initial dispatch trigger + expiry/retry consolidation
--
-- Fixes the booking flow: when a booking is inserted, immediately
-- dispatch to the nearest available verified provider.
-- If no provider is found, cancel the booking right away.
--
-- Also consolidates process_expired_dispatches() to use retry logic
-- (find next provider before cancelling) and ensures pg_cron is live.
-- ============================================================

-- ── 1. INITIAL DISPATCH TRIGGER ─────────────────────────────

CREATE OR REPLACE FUNCTION on_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_provider uuid;
BEGIN
  -- Find the nearest verified + available provider within 15 km
  SELECT provider_id INTO first_provider
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15)
  LIMIT 1;

  IF first_provider IS NOT NULL THEN
    -- Create the first 2-minute dispatch window
    INSERT INTO dispatch_queue (booking_id, provider_id, expires_at)
    VALUES (NEW.id, first_provider, now() + interval '2 minutes');

    -- Track attempt count
    UPDATE bookings
    SET dispatch_attempts = dispatch_attempts + 1
    WHERE id = NEW.id;
  ELSE
    -- No providers in range — cancel immediately so patient isn't left waiting
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop + recreate to avoid duplicate trigger errors on re-run
DROP TRIGGER IF EXISTS booking_initial_dispatch ON bookings;

CREATE TRIGGER booking_initial_dispatch
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION on_booking_created();

-- ── 2. EXPIRY + RETRY FUNCTION (consolidated) ───────────────
-- Re-creates the function with retry-next-provider logic.
-- This supersedes both migration 003 and 006 versions.

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_rec record;
  bk          record;
  next_prov   uuid;
BEGIN
  FOR expired_rec IN
    SELECT id, booking_id
    FROM dispatch_queue
    WHERE expires_at < now()
      AND response IS NULL
  LOOP
    -- Mark this offer expired
    UPDATE dispatch_queue
    SET response     = 'expired',
        responded_at = now()
    WHERE id = expired_rec.id;

    -- Only act if the booking is still pending
    SELECT id, patient_lat, patient_lng
    INTO bk
    FROM bookings
    WHERE id = expired_rec.booking_id
      AND status = 'pending';

    IF bk.id IS NULL THEN
      CONTINUE; -- already accepted / cancelled
    END IF;

    -- Find the next nearest provider not already tried
    SELECT p.id INTO next_prov
    FROM providers p
    WHERE p.verification_status = 'verified'
      AND p.available = true
      AND p.location IS NOT NULL
      AND p.id NOT IN (
        SELECT dq.provider_id
        FROM dispatch_queue dq
        WHERE dq.booking_id = expired_rec.booking_id
      )
      AND ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(bk.patient_lng, bk.patient_lat), 4326)::geography,
        15000
      )
    ORDER BY
      p.location <-> ST_SetSRID(ST_MakePoint(bk.patient_lng, bk.patient_lat), 4326)::geography
    LIMIT 1;

    IF next_prov IS NOT NULL THEN
      -- Route to next provider (Realtime notifies their app)
      INSERT INTO dispatch_queue (booking_id, provider_id, expires_at)
      VALUES (expired_rec.booking_id, next_prov, now() + interval '2 minutes');

      UPDATE bookings
      SET dispatch_attempts = dispatch_attempts + 1
      WHERE id = expired_rec.booking_id;
    ELSE
      -- No more providers in range — cancel the booking
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = now()
      WHERE id = expired_rec.booking_id;
    END IF;

  END LOOP;
END;
$$;

-- ── 3. PG_CRON SETUP ────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Safely (re)schedule: unschedule first if it exists, then reschedule.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-dispatch-queue');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-dispatch-offers');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'expire-dispatch-queue',
  '* * * * *',
  'SELECT process_expired_dispatches()'
);

-- ── 4. DISPATCH QUEUE RLS POLICIES (idempotent) ──────────────

DO $$
BEGIN
  -- Patients can insert dispatch entries for their own bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dispatch_queue'
      AND policyname = 'dispatch_queue_patient_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "dispatch_queue_patient_insert" ON dispatch_queue
        FOR INSERT WITH CHECK (
          booking_id IN (SELECT id FROM bookings WHERE patient_id = auth.uid())
        )
    $pol$;
  END IF;

  -- Providers see their offers; patients see dispatches for their bookings; admins see all
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dispatch_queue'
      AND policyname = 'dispatch_queue_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "dispatch_queue_read" ON dispatch_queue
        FOR SELECT USING (
          provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
          OR booking_id IN (SELECT id FROM bookings WHERE patient_id = auth.uid())
          OR get_user_role() = 'admin'
        )
    $pol$;
  END IF;

  -- Providers can respond (accept/decline) to their own offers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dispatch_queue'
      AND policyname = 'dispatch_queue_provider_respond'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "dispatch_queue_provider_respond" ON dispatch_queue
        FOR UPDATE USING (
          provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
        )
    $pol$;
  END IF;
END;
$$;