-- ============================================================
-- Migration 064: reviews and ratings across the platform
--
-- 1. Provider reviews
--    - update_provider_rating() ran as the reviewing patient, so RLS on
--      providers silently blocked the update and providers.rating never
--      moved. It is now SECURITY DEFINER, runs on delete too, ignores hidden
--      reviews, and keeps providers.review_count.
--    - Patients could insert a review for any booking. The insert policy now
--      requires their own completed booking with that provider.
--    - Replies (provider) and moderation (admin hides a review with a reason).
--      Both are written by server routes with the service role.
--    - Hidden reviews are readable only by the patient who wrote them, the
--      provider and admins.
--
-- 2. Facility reviews (new): patients rate a delivered pharmacy order, a
--    resulted lab order or a completed hospital referral. One review per
--    order. Written by a patient-web server route that checks ownership and
--    status; there is no client write policy. Partner tables get rating and
--    review_count, kept by a trigger.
-- ============================================================

-- ── 1. Provider reviews ─────────────────────────────────────
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply         text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS replied_at    timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden        boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden_reason text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden_at     timestamptz;

ALTER TABLE providers ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS reviews_provider_idx ON reviews (provider_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider uuid := COALESCE(NEW.provider_id, OLD.provider_id);
BEGIN
  UPDATE providers p
  SET rating = COALESCE(s.avg_rating, 0),
      review_count = COALESCE(s.n, 0)
  FROM (
    SELECT round(avg(rating)::numeric, 2) AS avg_rating, count(*)::int AS n
    FROM reviews
    WHERE provider_id = v_provider AND NOT hidden
  ) s
  WHERE p.id = v_provider;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.update_provider_rating() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_update_rating ON reviews;
CREATE TRIGGER reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- Bring every provider's figures up to date
UPDATE providers p
SET rating = COALESCE(s.avg_rating, 0),
    review_count = COALESCE(s.n, 0)
FROM (
  SELECT pr.id,
         (SELECT round(avg(r.rating)::numeric, 2) FROM reviews r WHERE r.provider_id = pr.id AND NOT r.hidden) AS avg_rating,
         (SELECT count(*)::int FROM reviews r WHERE r.provider_id = pr.id AND NOT r.hidden) AS n
  FROM providers pr
) s
WHERE p.id = s.id;

DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (
  NOT hidden
  OR patient_id = (SELECT auth.uid())
  OR provider_id IN (SELECT id FROM providers WHERE user_id = (SELECT auth.uid()))
  OR (SELECT public.get_user_role()) = 'admin'
);

DROP POLICY IF EXISTS "reviews_patient_insert" ON reviews;
CREATE POLICY "reviews_patient_insert" ON reviews FOR INSERT WITH CHECK (
  patient_id = (SELECT auth.uid())
  AND hidden = false
  AND reply IS NULL
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = reviews.booking_id
      AND b.patient_id = (SELECT auth.uid())
      AND b.provider_id = reviews.provider_id
      AND b.status = 'completed'
  )
);

-- ── 2. Facility reviews ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS facility_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_type text NOT NULL CHECK (facility_type IN ('pharmacy', 'lab', 'hospital')),
  facility_id   uuid NOT NULL,
  -- prescription_orders / investigation_orders / hospital_referrals id
  order_id      uuid NOT NULL,
  rating        int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text CHECK (comment IS NULL OR length(comment) <= 2000),
  reply         text CHECK (reply IS NULL OR length(reply) <= 2000),
  replied_at    timestamptz,
  hidden        boolean NOT NULL DEFAULT false,
  hidden_reason text,
  hidden_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_reviews_one_per_order UNIQUE (facility_type, order_id)
);

CREATE INDEX IF NOT EXISTS facility_reviews_facility_idx ON facility_reviews (facility_type, facility_id, created_at DESC);
CREATE INDEX IF NOT EXISTS facility_reviews_patient_idx ON facility_reviews (patient_id);

ALTER TABLE facility_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS facility_reviews_read ON facility_reviews;
CREATE POLICY facility_reviews_read ON facility_reviews FOR SELECT TO authenticated USING (
  NOT hidden
  OR patient_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) = 'admin'
);

ALTER TABLE pharmacy_partners ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 0;
ALTER TABLE pharmacy_partners ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;
ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 0;
ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF to_regclass('public.hospital_partners') IS NOT NULL THEN
    ALTER TABLE hospital_partners ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 0;
    ALTER TABLE hospital_partners ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_facility_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := COALESCE(NEW.facility_type, OLD.facility_type);
  v_id   uuid := COALESCE(NEW.facility_id, OLD.facility_id);
  v_avg  numeric;
  v_n    int;
  v_table text := CASE v_type WHEN 'pharmacy' THEN 'pharmacy_partners'
                              WHEN 'lab' THEN 'lab_partners'
                              ELSE 'hospital_partners' END;
BEGIN
  SELECT round(avg(rating)::numeric, 2), count(*)::int INTO v_avg, v_n
  FROM facility_reviews
  WHERE facility_type = v_type AND facility_id = v_id AND NOT hidden;

  EXECUTE format('UPDATE %I SET rating = $1, review_count = $2 WHERE id = $3', v_table)
    USING COALESCE(v_avg, 0), COALESCE(v_n, 0), v_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.update_facility_rating() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS facility_reviews_update_rating ON facility_reviews;
CREATE TRIGGER facility_reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON facility_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_facility_rating();
