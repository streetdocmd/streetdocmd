-- ============================================================
-- Migration 006: Dispatch queue RLS + expiry + decline handling
-- ============================================================

-- ============================================================
-- 1. DISPATCH QUEUE RLS POLICIES (currently missing — breaks everything)
-- ============================================================

-- Patients can create dispatch entries for their own bookings
CREATE POLICY "dispatch_queue_patient_insert" ON dispatch_queue
  FOR INSERT WITH CHECK (
    booking_id IN (SELECT id FROM bookings WHERE patient_id = auth.uid())
  );

-- Providers can see incoming offers assigned to them
-- Patients can see dispatches for their own bookings (for tracking)
-- Admins see all
CREATE POLICY "dispatch_queue_read" ON dispatch_queue
  FOR SELECT USING (
    provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR booking_id IN (SELECT id FROM bookings WHERE patient_id = auth.uid())
    OR get_user_role() = 'admin'
  );

-- Providers can respond (accept / decline) to their own dispatch entries
CREATE POLICY "dispatch_queue_provider_respond" ON dispatch_queue
  FOR UPDATE USING (
    provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  );

-- ============================================================
-- 2. TRIGGER: cancel booking immediately when provider declines
-- ============================================================

CREATE OR REPLACE FUNCTION on_dispatch_declined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.response = 'declined' AND OLD.response IS NULL THEN
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = NEW.booking_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_queue_on_decline
  AFTER UPDATE ON dispatch_queue
  FOR EACH ROW
  WHEN (OLD.response IS NULL AND NEW.response = 'declined')
  EXECUTE FUNCTION on_dispatch_declined();

-- ============================================================
-- 3. FUNCTION: process timed-out dispatch offers (called by pg_cron)
-- ============================================================

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INT;
BEGIN
  -- Mark any offer that passed its 2-minute window without a response
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now()
    AND response IS NULL;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Cancel any booking that now has no active (NULL response) dispatch entry
  -- but has at least one expired entry — i.e., the provider ran out of time
  UPDATE bookings
  SET status = 'cancelled', cancelled_at = now()
  WHERE status = 'pending'
    AND EXISTS (
      SELECT 1 FROM dispatch_queue dq
      WHERE dq.booking_id = bookings.id
        AND dq.response = 'expired'
    )
    AND NOT EXISTS (
      SELECT 1 FROM dispatch_queue dq
      WHERE dq.booking_id = bookings.id
        AND dq.response IS NULL
    );

  RETURN expired_count;
END;
$$;

-- ============================================================
-- 4. PG_CRON: run expiry check every minute
-- ============================================================

-- Enable pg_cron extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the expiry job — runs at the top of every minute
SELECT cron.schedule(
  'expire-dispatch-offers',
  '* * * * *',
  'SELECT process_expired_dispatches()'
);