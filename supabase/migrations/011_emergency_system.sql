-- emergencies: one record per SOS triggered by a patient
CREATE TABLE IF NOT EXISTS emergencies (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID          NOT NULL REFERENCES users(id),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  address          TEXT,
  status           TEXT          NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_by  UUID          REFERENCES users(id),
  acknowledged_at  TIMESTAMPTZ,
  resolved_by      UUID          REFERENCES users(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- emergency_contacts: ops/responder phone numbers that receive SMS alerts
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  phone      TEXT    NOT NULL,
  role       TEXT    NOT NULL DEFAULT 'ops',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE emergencies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Patients can create their own emergency records
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emergencies' AND policyname = 'patients_create_emergency'
  ) THEN
    CREATE POLICY "patients_create_emergency" ON emergencies
      FOR INSERT TO authenticated
      WITH CHECK (patient_id = auth.uid());
  END IF;
END $$;

-- Realtime so admin dashboard receives instant INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE emergencies;