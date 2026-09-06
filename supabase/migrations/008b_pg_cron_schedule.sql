-- ============================================================
-- Migration 008: pg_cron scheduling for dispatch expiry
--
-- Run AFTER migration 007. Sets up the every-minute job that
-- calls process_expired_dispatches() so stale offers are
-- retried/cancelled automatically.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Safely remove any old job names before re-scheduling
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

-- Schedule: every minute, call the retry/expiry function from migration 007
SELECT cron.schedule(
  'expire-dispatch-queue',
  '* * * * *',
  'SELECT process_expired_dispatches()'
);