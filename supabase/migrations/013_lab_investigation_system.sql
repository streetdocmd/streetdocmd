-- ============================================================
-- LAB INVESTIGATION SYSTEM
-- ============================================================

-- 1. Allow lab_staff role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'provider', 'admin', 'lab_staff'));

-- 2. Push token column for Expo notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token text;

-- 3. Extend lab_partners with geo + home collection
ALTER TABLE lab_partners
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS home_collection_available boolean NOT NULL DEFAULT false;

-- 4. Investigation catalogue (test menu per lab partner)
CREATE TABLE IF NOT EXISTS investigation_catalogue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_partner_id  uuid NOT NULL REFERENCES lab_partners(id) ON DELETE CASCADE,
  test_name       text NOT NULL,
  test_code       text,
  price           numeric(10,2) NOT NULL DEFAULT 0,
  turnaround_hours int,
  home_collection boolean NOT NULL DEFAULT false,
  sample_type     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. Investigation orders
CREATE TABLE IF NOT EXISTS investigation_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid REFERENCES bookings(id),
  patient_id      uuid NOT NULL REFERENCES users(id),
  provider_id     uuid NOT NULL REFERENCES providers(id),
  lab_partner_id  uuid NOT NULL REFERENCES lab_partners(id),
  -- snapshot of selected tests at order time: [{catalogue_id, test_name, test_code, price}]
  tests           jsonb NOT NULL DEFAULT '[]',
  clinical_notes  text,
  status          text NOT NULL DEFAULT 'ordered'
    CHECK (status IN (
      'ordered',
      'confirmed',
      'sample_collector_dispatched',
      'sample_collected',
      'processing',
      'resulted'
    )),
  ordered_at      timestamptz NOT NULL DEFAULT now(),
  resulted_at     timestamptz
);

-- 6. Investigation results (one row per test in the order)
CREATE TABLE IF NOT EXISTS investigation_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES investigation_orders(id) ON DELETE CASCADE,
  test_name       text NOT NULL,
  result_value    text,
  unit            text,
  reference_range text,
  flag            text CHECK (flag IN ('normal', 'high', 'low', 'critical')),
  result_pdf_url  text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- 7. Lab staff → lab partner linkage
CREATE TABLE IF NOT EXISTS lab_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  lab_partner_id  uuid NOT NULL REFERENCES lab_partners(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE investigation_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_staff               ENABLE ROW LEVEL SECURITY;

-- Catalogue: any authenticated user reads active tests; admin manages all
CREATE POLICY "catalogue_read" ON investigation_catalogue
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "catalogue_admin_all" ON investigation_catalogue
  FOR ALL USING (get_user_role() = 'admin');

-- Investigation orders: patient/provider/lab_staff/admin
CREATE POLICY "inv_orders_access" ON investigation_orders
  FOR ALL USING (
    patient_id = auth.uid()
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR get_user_role() IN ('admin', 'lab_staff')
  );

-- Investigation results: inherit access from parent order
CREATE POLICY "inv_results_access" ON investigation_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM investigation_orders io
      WHERE io.id = order_id AND (
        io.patient_id = auth.uid()
        OR io.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
        OR get_user_role() IN ('admin', 'lab_staff')
      )
    )
  );

-- Lab staff: admin manages; lab staff can read own record
CREATE POLICY "lab_staff_admin_all" ON lab_staff FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "lab_staff_self_read" ON lab_staff FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKET FOR LAB RESULT PDFs / IMAGES
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-results',
  'lab-results',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'lab_results_upload'
  ) THEN
    CREATE POLICY "lab_results_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'lab-results'
        AND get_user_role() IN ('admin', 'lab_staff')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'lab_results_public_read'
  ) THEN
    CREATE POLICY "lab_results_public_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'lab-results');
  END IF;
END $$;

-- ============================================================
-- REALTIME — lab portal and patient app subscribe to these
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE investigation_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE investigation_results;
