-- ============================================================
-- Migration 042: Patient-facing notification center
--
-- notifications_queue (016_clinical_note_system.sql) has always held real
-- patient-directed messages (follow_up/follow_up_care/follow_up_reminder,
-- preferred_provider_declined) but was purely a send-side queue for the
-- SMS/email worker -- the only RLS policy was admin_only_notifications,
-- so a patient could never read their own rows. This adds read/unread
-- state and lets a patient read and mark-read only their own
-- notifications, so the frontend bell/panel can be backed by this real
-- data instead of a purely visual icon.
-- ============================================================

ALTER TABLE notifications_queue ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications_queue ADD COLUMN IF NOT EXISTS read_at timestamptz;

DO $$ BEGIN
  CREATE POLICY notifications_patient_read ON notifications_queue
    FOR SELECT USING (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same scoping precedent as follow_ups_patient_book (030_follow_ups.sql):
-- a patient may update only their own row; no column-level restriction,
-- consistent with that existing policy's risk posture.
DO $$ BEGIN
  CREATE POLICY notifications_patient_update ON notifications_queue
    FOR UPDATE USING (patient_id = auth.uid())
    WITH CHECK (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Needed for the notification bell's realtime "new notification" updates,
-- same pattern as care_team_messages (041) and emergencies (011).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications_queue;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
