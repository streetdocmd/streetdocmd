-- ============================================================
-- Migration 058: facility profile details for patients
--
-- The patient app shows pharmacy, lab and hospital profiles (design:
-- facility-pharmacy, facility-lab, facility-hospital). They need a few
-- details the partner tables don't hold yet. All columns are optional and
-- partners fill them in from their portals; nothing existing changes.
--
--   pharmacy_partners  opening_hours, delivery_eta_minutes
--   drug_catalogue     low_stock_threshold  (stock at or below it shows "Low, N left")
--   lab_partners       opening_hours
--   hospital_partners  opening_hours, services
--   hospital_ward_capacity  (new) free and total beds per ward, kept current by
--                      the hospital; readable by any signed in user
-- ============================================================

ALTER TABLE pharmacy_partners ADD COLUMN IF NOT EXISTS opening_hours text;
ALTER TABLE pharmacy_partners ADD COLUMN IF NOT EXISTS delivery_eta_minutes int CHECK (delivery_eta_minutes IS NULL OR delivery_eta_minutes > 0);

ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS low_stock_threshold int NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0);

ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS opening_hours text;

-- hospital_partners was created outside these migrations; guard on its existence.
DO $$
BEGIN
  IF to_regclass('public.hospital_partners') IS NULL THEN
    RAISE NOTICE '058: hospital_partners not found, hospital columns and capacity table skipped';
    RETURN;
  END IF;

  ALTER TABLE hospital_partners ADD COLUMN IF NOT EXISTS opening_hours text;
  ALTER TABLE hospital_partners ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';

  CREATE TABLE IF NOT EXISTS hospital_ward_capacity (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_partner_id uuid NOT NULL REFERENCES hospital_partners(id) ON DELETE CASCADE,
    ward_name           text NOT NULL,
    total_beds          int  NOT NULL CHECK (total_beds >= 0),
    free_beds           int  NOT NULL CHECK (free_beds >= 0),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT hospital_ward_capacity_free_le_total CHECK (free_beds <= total_beds),
    CONSTRAINT hospital_ward_capacity_unique_ward UNIQUE (hospital_partner_id, ward_name)
  );

  ALTER TABLE hospital_ward_capacity ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS hospital_ward_capacity_read ON hospital_ward_capacity;
  CREATE POLICY hospital_ward_capacity_read ON hospital_ward_capacity
    FOR SELECT TO authenticated USING (true);

  -- Hospital staff manage their own hospital's wards; admins manage all.
  IF to_regclass('public.hospital_staff') IS NOT NULL THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS hospital_ward_capacity_staff_write ON hospital_ward_capacity;
      CREATE POLICY hospital_ward_capacity_staff_write ON hospital_ward_capacity
        FOR ALL TO authenticated
        USING (
          (SELECT public.get_user_role()) = 'admin'
          OR hospital_partner_id IN (SELECT hs.hospital_partner_id FROM hospital_staff hs WHERE hs.user_id = (SELECT auth.uid()))
        )
        WITH CHECK (
          (SELECT public.get_user_role()) = 'admin'
          OR hospital_partner_id IN (SELECT hs.hospital_partner_id FROM hospital_staff hs WHERE hs.user_id = (SELECT auth.uid()))
        );
    $p$;
  ELSE
    EXECUTE $p$
      DROP POLICY IF EXISTS hospital_ward_capacity_admin_write ON hospital_ward_capacity;
      CREATE POLICY hospital_ward_capacity_admin_write ON hospital_ward_capacity
        FOR ALL TO authenticated
        USING ((SELECT public.get_user_role()) = 'admin')
        WITH CHECK ((SELECT public.get_user_role()) = 'admin');
    $p$;
  END IF;

  CREATE INDEX IF NOT EXISTS hospital_ward_capacity_hospital_idx ON hospital_ward_capacity(hospital_partner_id);
END $$;
