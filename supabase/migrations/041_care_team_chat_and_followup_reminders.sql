-- ============================================================
-- Migration 041: Care team chat + follow-up reminder emails
--
-- Part 1 — Care team chat: a lightweight message log scoped to a care
-- episode, for the providers already on that episode's care team to
-- drop updates/handoff notes to each other. Deliberately provider-only
-- (not patient-facing) — same conservative default migration 028 already
-- established for care-episode data (existing tables' RLS was NOT
-- expanded to grant patients broader access than they already have).
-- Reuses is_care_team_member() from 028 rather than inventing new
-- authorization logic.
--
-- Part 2 — Follow-up reminders: follow_ups (030_follow_ups.sql) already
-- represents "this patient should be seen again, on this date" but
-- nothing ever reminds the patient. A daily cron finds follow-ups due
-- tomorrow (still 'scheduled' = nudge to book, or 'booked' = reminder of
-- the date) and queues an email via the existing notifications_queue /
-- process-notifications pipeline (migration 016/017, extended for email
-- in 037_preferred_provider_by_code.sql) — reusing that channel rather
-- than building a second notification path.
-- ============================================================

-- ── 1. CARE TEAM MESSAGES ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_team_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  provider_id     uuid NOT NULL REFERENCES providers(id),
  message         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_team_messages_episode_idx ON care_team_messages(care_episode_id, created_at);

ALTER TABLE care_team_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY care_team_messages_select ON care_team_messages
    FOR SELECT USING (
      is_care_team_member(care_episode_id) OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_team_messages_insert ON care_team_messages
    FOR INSERT WITH CHECK (
      is_care_team_member(care_episode_id)
      AND provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Needed for the chat panel's realtime subscription (same pattern
-- 011_emergency_system.sql used for the emergencies table).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE care_team_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. FOLLOW-UP REMINDER EMAILS ───────────────────────────────

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE OR REPLACE FUNCTION send_follow_up_reminders()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
  sent_count int := 0;
BEGIN
  FOR rec IN
    SELECT f.id, f.patient_id, f.follow_up_date, f.status,
           p.name AS provider_name
    FROM follow_ups f
    LEFT JOIN providers p ON p.id = f.continuing_provider_id
    WHERE f.follow_up_date = CURRENT_DATE + 1
      AND f.status IN ('scheduled', 'booked')
      AND f.reminder_sent_at IS NULL
  LOOP
    INSERT INTO notifications_queue (patient_id, channel, subject, message, send_at, type)
    VALUES (
      rec.patient_id, 'email',
      'Reminder: your follow-up visit is tomorrow',
      CASE WHEN rec.status = 'booked' THEN
        'This is a reminder that your follow-up visit is scheduled for tomorrow ('
        || to_char(rec.follow_up_date, 'FMDD Mon YYYY') || ').'
        || CASE WHEN rec.provider_name IS NOT NULL THEN ' With ' || rec.provider_name || '.' ELSE '' END
      ELSE
        'Your provider recommended a follow-up visit for tomorrow ('
        || to_char(rec.follow_up_date, 'FMDD Mon YYYY') || '). Open the app to book it.'
      END,
      now(), 'follow_up_reminder'
    );
    UPDATE follow_ups SET reminder_sent_at = now() WHERE id = rec.id;
    sent_count := sent_count + 1;
  END LOOP;
  RETURN sent_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN PERFORM cron.unschedule('send-follow-up-reminders'); EXCEPTION WHEN OTHERS THEN NULL; END; $$;

SELECT cron.schedule(
  'send-follow-up-reminders',
  '0 8 * * *', -- daily at 08:00 UTC
  'SELECT send_follow_up_reminders()'
);
