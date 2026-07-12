-- ============================================================
-- PHARMACY & DRUG DISPATCH SYSTEM
-- ============================================================

-- 1. Extend role check to include pharmacy_staff
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'provider', 'admin', 'lab_staff', 'pharmacy_staff'));

-- 2. Pharmacy partners
CREATE TABLE IF NOT EXISTS pharmacy_partners (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  address              text NOT NULL,
  lat                  numeric,
  lng                  numeric,
  phone                text NOT NULL,
  email                text,
  delivery_radius_km   numeric NOT NULL DEFAULT 10,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 3. Drug catalogue per pharmacy partner
CREATE TABLE IF NOT EXISTS drug_catalogue (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_partner_id  uuid NOT NULL REFERENCES pharmacy_partners(id) ON DELETE CASCADE,
  drug_name            text NOT NULL,
  generic_name         text,
  formulation          text,         -- tablet, capsule, syrup, injection, cream, etc.
  strength             text,         -- e.g. "500mg", "250mg/5ml"
  price                numeric(10,2) NOT NULL DEFAULT 0,
  prescription_required boolean NOT NULL DEFAULT false,
  in_stock             boolean NOT NULL DEFAULT true,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. Prescription orders (delivery request, separate from clinical prescriptions record)
CREATE TABLE IF NOT EXISTS prescription_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id             uuid REFERENCES visits(id),
  patient_id           uuid NOT NULL REFERENCES users(id),
  provider_id          uuid NOT NULL REFERENCES providers(id),
  pharmacy_partner_id  uuid NOT NULL REFERENCES pharmacy_partners(id),
  prescription_pdf_url text,
  -- snapshot: [{drug_id, drug_name, generic_name, strength, formulation, quantity, price}]
  drugs                jsonb NOT NULL DEFAULT '[]',
  status               text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'sent', 'confirmed',
      'dispensing', 'dispatched', 'delivered', 'cancelled'
    )),
  total_amount         numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount    numeric(12,2) NOT NULL DEFAULT 0,  -- 8% kept by StreetdocMD
  payment_status       text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'released')),
  payment_reference    text,
  requires_review      boolean NOT NULL DEFAULT false,    -- controlled drug flag
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 5. Delivery tracking
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_order_id   uuid NOT NULL REFERENCES prescription_orders(id) ON DELETE CASCADE,
  rider_name              text,
  rider_phone             text,
  dispatched_at           timestamptz,
  estimated_arrival       timestamptz,
  delivered_at            timestamptz,
  proof_of_delivery_url   text,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- 6. Pharmacy staff ↔ pharmacy partner linkage
CREATE TABLE IF NOT EXISTS pharmacy_staff (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  pharmacy_partner_id  uuid NOT NULL REFERENCES pharmacy_partners(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE pharmacy_partners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_catalogue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_staff     ENABLE ROW LEVEL SECURITY;

-- Pharmacy partners: public read for active; admin manages
CREATE POLICY "pharmacy_partners_read" ON pharmacy_partners
  FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "pharmacy_partners_admin" ON pharmacy_partners
  FOR ALL USING (get_user_role() = 'admin');

-- Drug catalogue: authenticated read; admin + pharmacy_staff manage
CREATE POLICY "drug_catalogue_read" ON drug_catalogue
  FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "drug_catalogue_manage" ON drug_catalogue
  FOR ALL USING (get_user_role() IN ('admin', 'pharmacy_staff'));

-- Prescription orders: patient / provider / pharmacy_staff / admin
CREATE POLICY "rx_orders_access" ON prescription_orders
  FOR ALL USING (
    patient_id = auth.uid()
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR get_user_role() IN ('admin', 'pharmacy_staff')
  );

-- Delivery tracking: inherits access from parent order
CREATE POLICY "delivery_tracking_access" ON delivery_tracking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM prescription_orders po
      WHERE po.id = prescription_order_id AND (
        po.patient_id = auth.uid()
        OR po.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
        OR get_user_role() IN ('admin', 'pharmacy_staff')
      )
    )
  );

-- Pharmacy staff: admin manages; staff reads own row
CREATE POLICY "pharmacy_staff_admin" ON pharmacy_staff FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "pharmacy_staff_self"  ON pharmacy_staff FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- STORAGE: proof of delivery + prescription uploads
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pharmacy-deliveries',
  'pharmacy-deliveries',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'pharmacy_delivery_upload'
  ) THEN
    CREATE POLICY "pharmacy_delivery_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'pharmacy-deliveries'
        AND get_user_role() IN ('admin', 'pharmacy_staff')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'pharmacy_delivery_read'
  ) THEN
    CREATE POLICY "pharmacy_delivery_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'pharmacy-deliveries');
  END IF;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prescription_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_tracking;
