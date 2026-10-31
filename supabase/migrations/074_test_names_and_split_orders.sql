-- ============================================================
-- Migration 074: Tests matched by meaning, missing tests, split orders
--
-- Builds on 073 (any lab can list any test). Platform tests are only a shared
-- name, so two labs' versions of a test count as the same test when orders
-- are matched and priced. Now:
--
--   Names    Labs and doctors can use any name. A test is found by its name or
--            one of its aliases (FBC, CBC, Complete Blood Count...). Close
--            names are only ever suggested (investigation_match_tests): a
--            person confirms "same test", which records their wording as a
--            new alias, so the list learns. Nothing merges on its own,
--            because similar names can be clinically different tests.
--   Missing  A doctor can't order a test no lab near the patient offers. They
--            can ask labs to add it (investigation_test_requests); the labs
--            are notified, and the doctor is told when one lists it.
--   Split    An order no single lab can do is split at checkout into one
--            order per lab (group_id), paid in one payment. Each part moves
--            on its own, so one lab never holds up the others' results.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS requested_only boolean NOT NULL DEFAULT false;
ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS requested_at timestamptz;
ALTER TABLE investigation_orders ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS investigation_orders_group_idx ON investigation_orders(group_id);

CREATE UNIQUE INDEX IF NOT EXISTS investigation_catalogue_platform_name_idx
  ON investigation_catalogue (lower(test_name)) WHERE scope = 'platform';

-- "Full Blood Count (FBC)" and "full-blood count" compare equal
CREATE OR REPLACE FUNCTION public.investigation_test_norm(p text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(regexp_replace(
    lower(replace(COALESCE(p, ''), '&', ' and ')),
    '[^a-z0-9]+', ' ', 'g'),
    '\m(test|tests|assay)\M', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

CREATE TABLE IF NOT EXISTS investigation_test_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_test_id uuid NOT NULL REFERENCES investigation_catalogue(id) ON DELETE CASCADE,
  alias            text NOT NULL,
  source           text NOT NULL DEFAULT 'seed',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS investigation_test_aliases_norm_idx ON investigation_test_aliases (public.investigation_test_norm(alias));
ALTER TABLE investigation_test_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investigation_test_aliases_read ON investigation_test_aliases;
CREATE POLICY investigation_test_aliases_read ON investigation_test_aliases FOR SELECT TO authenticated USING (true);

-- Doctors asking for a test no lab near their patient offers
CREATE TABLE IF NOT EXISTS investigation_test_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_test_id uuid NOT NULL REFERENCES investigation_catalogue(id) ON DELETE CASCADE,
  provider_id      uuid REFERENCES providers(id) ON DELETE CASCADE,
  booking_id       uuid REFERENCES bookings(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  notified_at      timestamptz
);
ALTER TABLE investigation_test_requests ENABLE ROW LEVEL SECURITY;

-- Common Nigerian lab names for the starting tests. Deliberately conservative:
-- e.g. a malaria RDT is not malaria microscopy, and urine m/c/s is not urinalysis.
INSERT INTO investigation_test_aliases (platform_test_id, alias)
SELECT c.id, a.alias
FROM (VALUES
  ('Full Blood Count', 'FBC'), ('Full Blood Count', 'CBC'), ('Full Blood Count', 'Complete Blood Count'),
  ('Full Blood Count', 'Full Blood Picture'), ('Full Blood Count', 'Haemogram'), ('Full Blood Count', 'Hemogram'),
  ('Malaria Parasite Test', 'MP'), ('Malaria Parasite Test', 'Malaria Parasite'), ('Malaria Parasite Test', 'Malaria Smear'),
  ('Malaria Parasite Test', 'Malaria Microscopy'), ('Malaria Parasite Test', 'Blood Film for Malaria Parasites'), ('Malaria Parasite Test', 'BFMP'),
  ('Widal Test (Typhoid)', 'Widal'), ('Widal Test (Typhoid)', 'Typhoid Test'), ('Widal Test (Typhoid)', 'Salmonella Widal'),
  ('Fasting Blood Sugar', 'FBS'), ('Fasting Blood Sugar', 'Fasting Blood Glucose'), ('Fasting Blood Sugar', 'FBG'),
  ('Fasting Blood Sugar', 'Fasting Plasma Glucose'),
  ('Lipid Profile', 'Lipid Panel'), ('Lipid Profile', 'Lipogram'), ('Lipid Profile', 'Fasting Lipid Profile'),
  ('Liver Function Test', 'LFT'), ('Liver Function Test', 'LFTs'), ('Liver Function Test', 'Liver Panel'),
  ('Kidney Function Test', 'KFT'), ('Kidney Function Test', 'RFT'), ('Kidney Function Test', 'Renal Function Test'),
  ('Kidney Function Test', 'E/U/Cr'), ('Kidney Function Test', 'EUCr'), ('Kidney Function Test', 'Electrolytes Urea and Creatinine'),
  ('Kidney Function Test', 'U&E'), ('Kidney Function Test', 'Urea and Electrolytes'),
  ('Thyroid Function Test', 'TFT'), ('Thyroid Function Test', 'Thyroid Panel'),
  ('Urinalysis', 'Urine Analysis'), ('Urinalysis', 'Urine Dipstick'), ('Urinalysis', 'Urine Routine'),
  ('HIV Screening', 'HIV Test'), ('HIV Screening', 'HIV 1 and 2'), ('HIV Screening', 'Retroviral Screening'), ('HIV Screening', 'RVS'),
  ('Hepatitis B Screening', 'HBsAg'), ('Hepatitis B Screening', 'Hepatitis B Surface Antigen'), ('Hepatitis B Screening', 'HBV Screening')
) AS a(test_name, alias)
JOIN investigation_catalogue c ON c.scope = 'platform' AND lower(c.test_name) = lower(a.test_name)
ON CONFLICT DO NOTHING;

-- The shared test with exactly this name or alias (after normalising), if any
CREATE OR REPLACE FUNCTION public.investigation_find_test(p_name text)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM (
    SELECT c.id, 1 AS rank FROM investigation_catalogue c
    WHERE c.scope = 'platform' AND investigation_test_norm(c.test_name) = investigation_test_norm(p_name)
    UNION ALL
    SELECT a.platform_test_id, 2 FROM investigation_test_aliases a
    WHERE investigation_test_norm(a.alias) = investigation_test_norm(p_name)
  ) m
  WHERE investigation_test_norm(p_name) <> ''
  ORDER BY rank LIMIT 1
$$;

-- Likely matches for a typed name, best first: exact, starts with, then fuzzy
CREATE OR REPLACE FUNCTION public.investigation_match_tests(p_query text, p_limit int DEFAULT 6)
 RETURNS TABLE (id uuid, test_name text, matched text, score real)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH q AS (SELECT investigation_test_norm(p_query) AS n),
  names AS (
    SELECT c.id, c.test_name, c.test_name AS label FROM investigation_catalogue c WHERE c.scope = 'platform' AND c.active
    UNION ALL
    SELECT c.id, c.test_name, a.alias FROM investigation_test_aliases a
    JOIN investigation_catalogue c ON c.id = a.platform_test_id AND c.active
  ),
  scored AS (
    SELECT names.id, names.test_name, names.label,
      GREATEST(
        CASE WHEN investigation_test_norm(names.label) = q.n THEN 1.0 ELSE 0 END,
        CASE WHEN investigation_test_norm(names.label) LIKE q.n || '%' THEN 0.9 ELSE 0 END,
        similarity(investigation_test_norm(names.label), q.n),
        word_similarity(q.n, investigation_test_norm(names.label))
      )::real AS score
    FROM names, q WHERE q.n <> ''
  )
  SELECT DISTINCT ON (s.id) s.id, s.test_name, s.label, s.score
  FROM scored s WHERE s.score >= 0.35
  ORDER BY s.id, s.score DESC
$$;

CREATE OR REPLACE FUNCTION public.investigation_match_tests_ranked(p_query text, p_limit int DEFAULT 6)
 RETURNS TABLE (id uuid, test_name text, matched text, score real)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.investigation_match_tests(p_query, p_limit) ORDER BY score DESC, test_name LIMIT p_limit
$$;

-- Records another way of naming a shared test
CREATE OR REPLACE FUNCTION public.investigation_add_alias(p_test uuid, p_alias text, p_source text DEFAULT 'lab')
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF investigation_test_norm(p_alias) = '' OR investigation_find_test(p_alias) IS NOT NULL THEN RETURN; END IF;
  INSERT INTO investigation_test_aliases (platform_test_id, alias, source)
  VALUES (p_test, left(trim(p_alias), 200), p_source) ON CONFLICT DO NOTHING;
END;
$$;

-- The shared test with this name or alias, created if it's new
CREATE OR REPLACE FUNCTION public.investigation_platform_test(p_name text, p_requested boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := left(regexp_replace(trim(COALESCE(p_name, '')), '\s+', ' ', 'g'), 200);
  v_id uuid := investigation_find_test(p_name);
BEGIN
  IF v_name = '' THEN RETURN NULL; END IF;

  IF v_id IS NULL THEN
    INSERT INTO investigation_catalogue (scope, test_name, price, requested_only)
    VALUES ('platform', v_name, 0, p_requested)
    ON CONFLICT (lower(test_name)) WHERE scope = 'platform' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN v_id := investigation_find_test(v_name); END IF;
  ELSE
    UPDATE investigation_catalogue SET active = true WHERE id = v_id AND NOT active;
  END IF;
  RETURN v_id;
END;
$function$;

-- Asks every active lab whether it offers a test (at most weekly per test)
CREATE OR REPLACE FUNCTION public.investigation_ask_labs(p_test uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  r record;
BEGIN
  UPDATE investigation_catalogue SET requested_at = now()
  WHERE id = p_test AND (requested_at IS NULL OR requested_at < now() - interval '7 days')
  RETURNING test_name INTO v_name;
  IF v_name IS NULL THEN RETURN; END IF;
  FOR r IN SELECT id FROM lab_partners WHERE active LOOP
    PERFORM notify_facility('lab', r.id, 'orders', 'Do you offer ' || v_name || '?',
      'A StreetdocMD doctor requested it and no lab near the patient lists it. Add it to your price list if you can do it.',
      '/lab-portal/tests');
  END LOOP;
END;
$$;

-- How many labs that could serve this address offer each test
CREATE OR REPLACE FUNCTION public.investigation_test_coverage(p_test_ids uuid[], p_lat double precision, p_lng double precision, p_collection text DEFAULT 'home')
 RETURNS TABLE (platform_test_id uuid, labs integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, COUNT(DISTINCT l.id)::int
  FROM unnest(p_test_ids) AS t(id)
  LEFT JOIN investigation_catalogue c ON c.platform_test_id = t.id AND c.scope = 'lab_partner' AND c.active
  LEFT JOIN lab_partners l ON l.id = c.lab_partner_id
    AND l.active AND l.lat IS NOT NULL AND l.lng IS NOT NULL
    AND (p_collection = 'doctor' OR l.home_collection_available)
    AND NOT (COALESCE(l.review_count, 0) >= 3 AND COALESCE(l.rating, 0) < 3)
    AND p_lat IS NOT NULL AND p_lng IS NOT NULL
    AND public.km_between(p_lat, p_lng, l.lat::double precision, l.lng::double precision) <= l.service_radius_km
  GROUP BY t.id
$$;

-- Every eligible lab's offer for each test, for splitting an order
CREATE OR REPLACE FUNCTION public.investigation_offers(p_test_ids uuid[], p_lat double precision, p_lng double precision, p_collection text DEFAULT 'home')
 RETURNS TABLE (lab_partner_id uuid, lab_name text, collection_fee numeric, distance_km double precision, rating numeric, review_count integer,
   platform_test_id uuid, lab_catalogue_id uuid, price numeric, lab_test_name text, preparation text, turnaround_hours integer, sample_type text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (l.id, c.platform_test_id)
    l.id, l.name,
    CASE WHEN p_collection = 'doctor' THEN 0 ELSE l.home_collection_fee END,
    public.km_between(p_lat, p_lng, l.lat::double precision, l.lng::double precision),
    COALESCE(l.rating, 0), COALESCE(l.review_count, 0),
    c.platform_test_id, c.id, c.price, c.test_name, c.preparation, c.turnaround_hours, c.sample_type
  FROM lab_partners l
  JOIN investigation_catalogue c ON c.lab_partner_id = l.id AND c.scope = 'lab_partner' AND c.active
  WHERE c.platform_test_id = ANY (p_test_ids)
    AND l.active AND l.lat IS NOT NULL AND l.lng IS NOT NULL
    AND (p_collection = 'doctor' OR l.home_collection_available)
    AND NOT (COALESCE(l.review_count, 0) >= 3 AND COALESCE(l.rating, 0) < 3)
    AND p_lat IS NOT NULL AND p_lng IS NOT NULL
    AND public.km_between(p_lat, p_lng, l.lat::double precision, l.lng::double precision) <= l.service_radius_km
  ORDER BY l.id, c.platform_test_id, c.price
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'investigation_find_test(text)', 'investigation_match_tests(text, int)', 'investigation_match_tests_ranked(text, int)',
    'investigation_add_alias(uuid, text, text)', 'investigation_platform_test(text, boolean)', 'investigation_ask_labs(uuid)',
    'investigation_test_coverage(uuid[], double precision, double precision, text)',
    'investigation_offers(uuid[], double precision, double precision, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- Lab tests added before this migration
UPDATE investigation_catalogue
SET platform_test_id = public.investigation_platform_test(test_name)
WHERE scope = 'lab_partner' AND platform_test_id IS NULL;

-- A lab listing a test makes it available, and tells doctors who asked for it
CREATE OR REPLACE FUNCTION public.investigation_test_listed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_name text;
BEGIN
  UPDATE investigation_catalogue SET requested_only = false WHERE id = NEW.platform_test_id AND requested_only;
  SELECT test_name INTO v_name FROM investigation_catalogue WHERE id = NEW.platform_test_id;

  FOR r IN
    SELECT DISTINCT ON (provider_id) id, provider_id FROM investigation_test_requests
    WHERE platform_test_id = NEW.platform_test_id AND notified_at IS NULL AND provider_id IS NOT NULL
  LOOP
    PERFORM notify(provider_user(r.provider_id), 'orders', 'A lab now offers ' || COALESCE(v_name, 'a test you asked for'),
      'You asked for this test. Check it reaches your patient before ordering it.', '/dashboard', 'provider');
  END LOOP;
  UPDATE investigation_test_requests SET notified_at = now()
  WHERE platform_test_id = NEW.platform_test_id AND notified_at IS NULL;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS investigation_catalogue_listed ON investigation_catalogue;
CREATE TRIGGER investigation_catalogue_listed
  AFTER INSERT OR UPDATE OF platform_test_id, active ON investigation_catalogue
  FOR EACH ROW
  WHEN (NEW.scope = 'lab_partner' AND NEW.active AND NEW.platform_test_id IS NOT NULL)
  EXECUTE FUNCTION investigation_test_listed();

NOTIFY pgrst, 'reload schema';
