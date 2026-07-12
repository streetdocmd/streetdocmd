-- ============================================================
-- FIX: Emergency RLS policies for admin browser client
-- EmergencyAlert.tsx subscribes via anon key (browser client),
-- which is subject to RLS. Without these policies, the real-time
-- banner and initial fetch return empty results for admin users.
-- ============================================================

-- Admin can read and manage all emergency records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emergencies' AND policyname = 'admin_all_emergencies'
  ) THEN
    CREATE POLICY "admin_all_emergencies" ON emergencies
      FOR ALL USING (get_user_role() = 'admin');
  END IF;
END $$;

-- Patients can read their own emergencies (to show status in UI)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emergencies' AND policyname = 'patients_read_own_emergencies'
  ) THEN
    CREATE POLICY "patients_read_own_emergencies" ON emergencies
      FOR SELECT USING (patient_id = auth.uid());
  END IF;
END $$;

-- Admin can manage emergency contacts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emergency_contacts' AND policyname = 'admin_all_emergency_contacts'
  ) THEN
    CREATE POLICY "admin_all_emergency_contacts" ON emergency_contacts
      FOR ALL USING (get_user_role() = 'admin');
  END IF;
END $$;
