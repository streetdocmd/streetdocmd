-- Add sent/sent_at/error columns to notifications_queue if not already present
ALTER TABLE notifications_queue
  ADD COLUMN IF NOT EXISTS sent      boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS error     text;

-- Index to efficiently query due, unsent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_queue_unsent
  ON notifications_queue (send_at, sent)
  WHERE sent = false;

-- Schedule the process-notifications Edge Function every 15 minutes via pg_cron
-- Requires the pg_cron and pg_net extensions to be enabled in Supabase dashboard
SELECT cron.schedule(
  'process-notifications',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
