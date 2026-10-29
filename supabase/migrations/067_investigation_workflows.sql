-- ============================================================
-- Migration 067: one fulfilment engine for investigations
--
-- Both ways a test is started share this engine:
--   doctor:  ordered during a visit -> patient approves -> pays
--   patient: picks tests (optionally with an outside doctor's request) -> pays
-- then: best lab chosen at checkout -> lab has 30 minutes to accept -> next
-- best lab on decline or timeout -> collection -> lab -> results -> doctor
-- review (doctor orders) -> completed.
--
-- What changes
--   investigation_orders   full status list, pricing and payment, collection,
--                          external request, lab assignment, doctor review
--   investigation_order_events  every status change with who did it (audit)
--   investigation_lab_attempts  each lab asked, and how it answered
--   investigation_shares   time limited links a patient creates to share results
--   investigation_catalogue.platform_test_id  links a lab's test to the
--                          StreetdocMD test it fulfils (used for matching)
--   lab_partners           home_collection_fee, service_radius_km
--   care_episodes          investigation_handover_note; an episode can't be
--                          closed while a linked result awaits review unless
--                          it is handed over
--   lab-results storage    no longer public; reports are served through short
--                          lived signed links after an access check
--
-- Rules (decided by the product owner)
--   price: the best lab is picked before checkout (cheapest total, then
--     rating; labs rated under 3 with 3 or more reviews are skipped) and the
--     patient pays that lab's listed prices plus its collection fee and the
--     5 percent service charge. A fallback lab fulfils at the price paid.
--   collection fee: set by each lab; none when the doctor took the sample.
--   lab window: 30 minutes, then the next lab. No lab left: exception.
--   patients can't cancel once paid.
-- ============================================================

-- ── 1. Lab partners and catalogue ───────────────────────────
ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS home_collection_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (home_collection_fee >= 0);
ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,1) NOT NULL DEFAULT 25 CHECK (service_radius_km > 0);

ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS platform_test_id uuid REFERENCES investigation_catalogue(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS investigation_catalogue_platform_test_idx ON investigation_catalogue(platform_test_id);

-- Link existing lab tests to the StreetdocMD test with the same code, else name
UPDATE investigation_catalogue c
SET platform_test_id = p.id
FROM investigation_catalogue p
WHERE c.scope = 'lab_partner' AND c.platform_test_id IS NULL
  AND p.scope = 'platform'
  AND (
    (c.test_code IS NOT NULL AND p.test_code IS NOT NULL AND lower(trim(c.test_code)) = lower(trim(p.test_code)))
    OR lower(trim(c.test_name)) = lower(trim(p.test_name))
  );

-- ── 2. Orders ───────────────────────────────────────────────
ALTER TABLE investigation_orders ALTER COLUMN lab_partner_id DROP NOT NULL;

ALTER TABLE investigation_orders
  ADD COLUMN IF NOT EXISTS collection_method   text NOT NULL DEFAULT 'home' CHECK (collection_method IN ('home', 'doctor')),
  ADD COLUMN IF NOT EXISTS tests_total         numeric(12,2),
  ADD COLUMN IF NOT EXISTS collection_fee      numeric(12,2),
  ADD COLUMN IF NOT EXISTS service_charge      numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_amount        numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_status      text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'not_required')),
  ADD COLUMN IF NOT EXISTS payment_reference   text,
  ADD COLUMN IF NOT EXISTS amount_paid         numeric(12,2),
  ADD COLUMN IF NOT EXISTS paid_at             timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status       text CHECK (refund_status IN ('due', 'refunded')),
  ADD COLUMN IF NOT EXISTS collection_address  text,
  ADD COLUMN IF NOT EXISTS collection_lat      double precision,
  ADD COLUMN IF NOT EXISTS collection_lng      double precision,
  ADD COLUMN IF NOT EXISTS preferred_date      date,
  ADD COLUMN IF NOT EXISTS preferred_window    text CHECK (preferred_window IN ('morning', 'afternoon', 'evening')),
  ADD COLUMN IF NOT EXISTS contact_phone       text,
  ADD COLUMN IF NOT EXISTS external_request    jsonb,
  ADD COLUMN IF NOT EXISTS lab_price_total     numeric(12,2),
  ADD COLUMN IF NOT EXISTS lab_requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS lab_deadline        timestamptz,
  ADD COLUMN IF NOT EXISTS lab_attempts        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collection_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS collected_at        timestamptz,
  ADD COLUMN IF NOT EXISTS collected_by        text,
  ADD COLUMN IF NOT EXISTS identity_checked    boolean,
  ADD COLUMN IF NOT EXISTS sample_notes        text,
  ADD COLUMN IF NOT EXISTS received_at         timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_critical        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS patient_viewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS review_interpretation text,
  ADD COLUMN IF NOT EXISTS review_next_step    text CHECK (review_next_step IN ('none', 'treatment', 'repeat_test', 'referral', 'follow_up')),
  ADD COLUMN IF NOT EXISTS review_notes        text,
  ADD COLUMN IF NOT EXISTS exception_reason    text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- Existing orders: map the six old statuses onto the new list. They were
-- never paid through StreetdocMD, so payment is not required for them.
ALTER TABLE investigation_orders DROP CONSTRAINT IF EXISTS investigation_orders_status_check;
UPDATE investigation_orders SET payment_status = 'not_required' WHERE payment_status = 'unpaid';
UPDATE investigation_orders SET status = CASE status
  WHEN 'ordered' THEN 'lab_requested'
  WHEN 'confirmed' THEN 'lab_accepted'
  WHEN 'sample_collector_dispatched' THEN 'collection_scheduled'
  WHEN 'sample_collected' THEN 'sample_collected'
  WHEN 'processing' THEN 'analysis_in_progress'
  WHEN 'resulted' THEN 'completed'
  ELSE status END;

ALTER TABLE investigation_orders ADD CONSTRAINT investigation_orders_status_check CHECK (status IN (
  'draft', 'awaiting_patient_approval', 'declined_by_patient',
  'awaiting_payment', 'payment_failed', 'paid_awaiting_lab',
  'lab_requested', 'lab_accepted', 'collection_scheduled', 'sample_collected',
  'in_transit', 'received_at_lab', 'analysis_in_progress', 'results_uploaded',
  'doctor_review_pending', 'reviewed', 'follow_up_required',
  'completed', 'cancelled', 'exception'
));
ALTER TABLE investigation_orders ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS investigation_orders_status_idx ON investigation_orders(status);
CREATE INDEX IF NOT EXISTS investigation_orders_deadline_idx ON investigation_orders(lab_deadline) WHERE status = 'lab_requested';

-- ── 3. Events (audit), lab attempts, shares ─────────────────
CREATE TABLE IF NOT EXISTS investigation_order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES investigation_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status   text,
  actor_id    uuid,
  actor_role  text,   -- patient, doctor, lab, admin, system
  note        text,
  data        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investigation_order_events_order_idx ON investigation_order_events(order_id, created_at);
ALTER TABLE investigation_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investigation_order_events_read ON investigation_order_events;
CREATE POLICY investigation_order_events_read ON investigation_order_events FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM investigation_orders o WHERE o.id = order_id AND (
      o.patient_id = (SELECT auth.uid())
      OR o.provider_id IN (SELECT id FROM providers WHERE user_id = (SELECT auth.uid()))
      OR (SELECT public.get_user_role()) = 'admin'
    )
  )
);

CREATE TABLE IF NOT EXISTS investigation_lab_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES investigation_orders(id) ON DELETE CASCADE,
  lab_partner_id uuid NOT NULL REFERENCES lab_partners(id),
  lab_price_total numeric(12,2),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  outcome        text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'accepted', 'declined', 'timed_out')),
  reason         text
);
CREATE INDEX IF NOT EXISTS investigation_lab_attempts_order_idx ON investigation_lab_attempts(order_id);
ALTER TABLE investigation_lab_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investigation_lab_attempts_admin ON investigation_lab_attempts;
CREATE POLICY investigation_lab_attempts_admin ON investigation_lab_attempts FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE TABLE IF NOT EXISTS investigation_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES investigation_orders(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE investigation_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investigation_shares_own ON investigation_shares;
CREATE POLICY investigation_shares_own ON investigation_shares FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- ── 4. Access: lab staff see their orders only once requested ─
DROP POLICY IF EXISTS inv_orders_lab_staff_scope ON investigation_orders;
CREATE POLICY inv_orders_lab_staff_scope ON investigation_orders
  AS RESTRICTIVE FOR ALL
  USING (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR (
      lab_partner_id IN (SELECT ls.lab_partner_id FROM lab_staff ls WHERE ls.user_id = auth.uid())
      AND status NOT IN ('draft', 'awaiting_patient_approval', 'declined_by_patient', 'awaiting_payment', 'payment_failed', 'paid_awaiting_lab')
    )
  )
  WITH CHECK (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR lab_partner_id IN (SELECT ls.lab_partner_id FROM lab_staff ls WHERE ls.user_id = auth.uid())
  );

-- Doctors may only create orders from the app; every later change goes
-- through server routes and investigation_transition().
DROP POLICY IF EXISTS inv_orders_provider_write ON investigation_orders;
DROP POLICY IF EXISTS inv_orders_doctor_insert ON investigation_orders;
CREATE POLICY inv_orders_doctor_insert ON investigation_orders FOR INSERT WITH CHECK (
  provider_id IN (SELECT id FROM providers WHERE user_id = (SELECT auth.uid()))
  AND (SELECT get_provider_profession()) = 'doctor'
);
DROP POLICY IF EXISTS inv_orders_admin_all ON investigation_orders;
CREATE POLICY inv_orders_admin_all ON investigation_orders FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin') WITH CHECK ((SELECT public.get_user_role()) = 'admin');

-- ── 5. Results storage: private ─────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'lab-results';
DROP POLICY IF EXISTS "lab_results_public_read" ON storage.objects;
DROP POLICY IF EXISTS "lab_results_upload" ON storage.objects;
-- Stored values become storage paths; links are signed on demand
UPDATE investigation_results
SET result_pdf_url = regexp_replace(result_pdf_url, '^.*/storage/v1/object/(public|sign)/lab-results/', '')
WHERE result_pdf_url ~ '/storage/v1/object/(public|sign)/lab-results/';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('investigation-requests', 'investigation-requests', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- ── 6. Helpers ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- StreetdocMD test ids in an order's test snapshot
CREATE OR REPLACE FUNCTION public.investigation_platform_tests(p_tests jsonb)
RETURNS uuid[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT (t->>'platform_test_id')::uuid) FILTER (WHERE t->>'platform_test_id' IS NOT NULL), '{}')
  FROM jsonb_array_elements(COALESCE(p_tests, '[]'::jsonb)) t
$$;

-- Eligible labs for a set of tests at a location, best first.
-- Cheapest total (tests plus collection fee), then rating, then distance.
CREATE OR REPLACE FUNCTION public.investigation_quote(
  p_test_ids uuid[], p_lat double precision, p_lng double precision,
  p_collection text DEFAULT 'home', p_exclude uuid[] DEFAULT '{}'
) RETURNS TABLE (
  lab_partner_id uuid, lab_name text, tests_total numeric, collection_fee numeric,
  distance_km double precision, rating numeric, review_count int, items jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH offers AS (
    SELECT DISTINCT ON (l.id, c.platform_test_id)
      l.id AS lab_id, c.platform_test_id, c.id AS lab_catalogue_id, c.price,
      c.test_name AS lab_test_name, c.preparation, c.turnaround_hours, c.sample_type
    FROM lab_partners l
    JOIN investigation_catalogue c ON c.lab_partner_id = l.id AND c.scope = 'lab_partner' AND c.active
    WHERE c.platform_test_id = ANY (p_test_ids)
    ORDER BY l.id, c.platform_test_id, c.price
  ), labs AS (
    SELECT l.id, l.name,
      COALESCE(l.rating, 0) AS rating, COALESCE(l.review_count, 0) AS review_count,
      CASE WHEN p_collection = 'doctor' THEN 0 ELSE l.home_collection_fee END AS fee,
      public.km_between(p_lat, p_lng, l.lat::double precision, l.lng::double precision) AS km,
      l.service_radius_km
    FROM lab_partners l
    WHERE l.active
      AND l.lat IS NOT NULL AND l.lng IS NOT NULL
      AND NOT (l.id = ANY (p_exclude))
      AND (p_collection = 'doctor' OR l.home_collection_available)
      AND NOT (COALESCE(l.review_count, 0) >= 3 AND COALESCE(l.rating, 0) < 3)
  )
  SELECT labs.id, labs.name, SUM(o.price) AS tests_total, labs.fee, labs.km, labs.rating, labs.review_count,
    jsonb_agg(jsonb_build_object(
      'platform_test_id', o.platform_test_id, 'lab_catalogue_id', o.lab_catalogue_id, 'price', o.price,
      'lab_test_name', o.lab_test_name, 'preparation', o.preparation,
      'turnaround_hours', o.turnaround_hours, 'sample_type', o.sample_type
    )) AS items
  FROM labs JOIN offers o ON o.lab_id = labs.id
  WHERE p_lat IS NOT NULL AND p_lng IS NOT NULL AND labs.km <= labs.service_radius_km
  GROUP BY labs.id, labs.name, labs.fee, labs.km, labs.rating, labs.review_count
  HAVING COUNT(DISTINCT o.platform_test_id) = COALESCE(array_length(p_test_ids, 1), 0)
  ORDER BY SUM(o.price) + labs.fee, labs.rating DESC, labs.km
$$;

-- ── 7. Transitions: the only way the status changes ─────────
CREATE OR REPLACE FUNCTION public.investigation_can_move(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_to = 'exception' AND p_from NOT IN ('completed', 'cancelled', 'declined_by_patient')
  OR (p_from, p_to) IN (
    ('draft', 'awaiting_payment'), ('draft', 'awaiting_patient_approval'), ('draft', 'cancelled'),
    ('awaiting_patient_approval', 'awaiting_payment'), ('awaiting_patient_approval', 'declined_by_patient'),
    ('awaiting_patient_approval', 'cancelled'),
    ('awaiting_payment', 'paid_awaiting_lab'), ('awaiting_payment', 'payment_failed'),
    ('awaiting_payment', 'cancelled'), ('awaiting_payment', 'awaiting_payment'),
    ('payment_failed', 'awaiting_payment'), ('payment_failed', 'paid_awaiting_lab'), ('payment_failed', 'cancelled'),
    ('paid_awaiting_lab', 'lab_requested'),
    ('lab_requested', 'lab_requested'), ('lab_requested', 'lab_accepted'),
    ('lab_accepted', 'collection_scheduled'), ('lab_accepted', 'sample_collected'),
    ('collection_scheduled', 'collection_scheduled'), ('collection_scheduled', 'sample_collected'),
    ('sample_collected', 'in_transit'), ('sample_collected', 'received_at_lab'),
    ('in_transit', 'received_at_lab'),
    ('received_at_lab', 'analysis_in_progress'),
    ('analysis_in_progress', 'results_uploaded'),
    ('results_uploaded', 'doctor_review_pending'), ('results_uploaded', 'completed'),
    ('doctor_review_pending', 'reviewed'), ('doctor_review_pending', 'follow_up_required'),
    ('reviewed', 'completed'), ('follow_up_required', 'completed'),
    ('exception', 'lab_requested'), ('exception', 'cancelled')
  )
$$;

CREATE OR REPLACE FUNCTION public.investigation_transition(
  p_order uuid, p_to text, p_actor uuid DEFAULT NULL, p_role text DEFAULT 'system',
  p_note text DEFAULT NULL, p_data jsonb DEFAULT '{}'
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from text;
BEGIN
  SELECT status INTO v_from FROM investigation_orders WHERE id = p_order FOR UPDATE;
  IF v_from IS NULL THEN RETURN 'not_found'; END IF;
  IF NOT public.investigation_can_move(v_from, p_to) THEN RETURN 'not_allowed:' || v_from; END IF;

  UPDATE investigation_orders SET
    status = p_to,
    updated_at = now(),
    exception_reason = CASE WHEN p_to = 'exception' THEN COALESCE(p_note, exception_reason) ELSE exception_reason END,
    received_at = CASE WHEN p_to = 'received_at_lab' THEN now() ELSE received_at END,
    analysis_started_at = CASE WHEN p_to = 'analysis_in_progress' THEN now() ELSE analysis_started_at END,
    resulted_at = CASE WHEN p_to = 'results_uploaded' THEN now() ELSE resulted_at END,
    reviewed_at = CASE WHEN p_to IN ('reviewed', 'follow_up_required') THEN now() ELSE reviewed_at END
  WHERE id = p_order;

  INSERT INTO investigation_order_events (order_id, from_status, to_status, actor_id, actor_role, note, data)
  VALUES (p_order, v_from, p_to, p_actor, p_role, p_note, COALESCE(p_data, '{}'));
  RETURN 'ok';
END;
$$;

-- Ask the next lab: the order's own lab first (chosen at checkout), then the
-- best remaining eligible lab. No lab left: operations exception.
CREATE OR REPLACE FUNCTION public.investigation_request_lab(p_order uuid, p_use_current boolean DEFAULT false, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o investigation_orders%ROWTYPE;
  v_tried uuid[];
  v_lab uuid;
  v_price numeric;
BEGIN
  SELECT * INTO o FROM investigation_orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL THEN RETURN 'not_found'; END IF;

  SELECT COALESCE(array_agg(lab_partner_id), '{}') INTO v_tried FROM investigation_lab_attempts WHERE order_id = p_order;

  IF p_use_current AND o.lab_partner_id IS NOT NULL AND NOT (o.lab_partner_id = ANY (v_tried)) THEN
    v_lab := o.lab_partner_id;
    v_price := o.lab_price_total;
  ELSIF o.lab_attempts < 3 THEN
    SELECT lab_partner_id, tests_total INTO v_lab, v_price FROM public.investigation_quote(
      public.investigation_platform_tests(o.tests), o.collection_lat, o.collection_lng, o.collection_method, v_tried
    ) LIMIT 1;
  END IF;

  IF v_lab IS NULL THEN
    PERFORM public.investigation_transition(p_order, 'exception', NULL, 'system',
      COALESCE(p_reason || '. ', '') || 'No partner lab is left to fulfil this order.');
    RETURN 'exception';
  END IF;

  UPDATE investigation_orders SET
    lab_partner_id = v_lab, lab_price_total = v_price,
    lab_requested_at = now(), lab_deadline = now() + interval '30 minutes',
    lab_attempts = lab_attempts + 1
  WHERE id = p_order;
  INSERT INTO investigation_lab_attempts (order_id, lab_partner_id, lab_price_total) VALUES (p_order, v_lab, v_price);
  PERFORM public.investigation_transition(p_order, 'lab_requested', NULL, 'system', p_reason, jsonb_build_object('lab_partner_id', v_lab));
  RETURN 'ok';
END;
$$;

-- Paystack webhook: idempotent; only a matching amount confirms
CREATE OR REPLACE FUNCTION public.investigation_confirm_payment(p_order uuid, p_amount numeric, p_reference text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o investigation_orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM investigation_orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL THEN RETURN 'not_found'; END IF;
  IF o.payment_status = 'paid' THEN RETURN 'already_paid'; END IF;
  IF o.status NOT IN ('awaiting_payment', 'payment_failed') THEN RETURN 'bad_state:' || o.status; END IF;
  IF o.total_amount IS NULL OR round(p_amount, 2) <> round(o.total_amount, 2) THEN
    INSERT INTO investigation_order_events (order_id, from_status, to_status, actor_role, note, data)
    VALUES (p_order, o.status, o.status, 'system', 'Payment amount did not match the order total',
      jsonb_build_object('paid', p_amount, 'expected', o.total_amount, 'reference', p_reference));
    RETURN 'amount_mismatch';
  END IF;

  UPDATE investigation_orders SET payment_status = 'paid', amount_paid = p_amount, paid_at = now(), payment_reference = p_reference
  WHERE id = p_order;
  PERFORM public.investigation_transition(p_order, 'paid_awaiting_lab', NULL, 'system', 'Payment confirmed', jsonb_build_object('reference', p_reference));
  PERFORM public.investigation_request_lab(p_order, true);
  RETURN 'ok';
END;
$$;

-- Lab answers a request
CREATE OR REPLACE FUNCTION public.investigation_lab_respond(p_order uuid, p_lab uuid, p_accept boolean, p_actor uuid, p_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o investigation_orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM investigation_orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL OR o.lab_partner_id IS DISTINCT FROM p_lab THEN RETURN 'not_found'; END IF;
  IF o.status <> 'lab_requested' THEN RETURN 'not_allowed:' || o.status; END IF;

  UPDATE investigation_lab_attempts SET outcome = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    responded_at = now(), reason = p_reason
  WHERE order_id = p_order AND lab_partner_id = p_lab AND outcome = 'pending';

  IF p_accept THEN
    UPDATE investigation_orders SET lab_deadline = NULL WHERE id = p_order;
    RETURN public.investigation_transition(p_order, 'lab_accepted', p_actor, 'lab');
  END IF;

  INSERT INTO investigation_order_events (order_id, from_status, to_status, actor_id, actor_role, note)
  VALUES (p_order, o.status, o.status, p_actor, 'lab', 'Lab declined' || COALESCE(': ' || p_reason, ''));
  RETURN public.investigation_request_lab(p_order, false, 'Previous lab declined');
END;
$$;

-- Cron: requests not answered within 30 minutes move to the next lab
CREATE OR REPLACE FUNCTION public.investigation_lab_timeouts()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT id, lab_partner_id FROM investigation_orders
           WHERE status = 'lab_requested' AND lab_deadline IS NOT NULL AND lab_deadline < now()
  LOOP
    UPDATE investigation_lab_attempts SET outcome = 'timed_out', responded_at = now()
    WHERE order_id = r.id AND lab_partner_id = r.lab_partner_id AND outcome = 'pending';
    PERFORM public.investigation_request_lab(r.id, false, 'Previous lab did not respond within 30 minutes');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

DO $$ BEGIN PERFORM cron.unschedule('investigation-lab-timeouts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('investigation-lab-timeouts', '*/5 * * * *', 'SELECT public.investigation_lab_timeouts()');

REVOKE ALL ON FUNCTION public.investigation_quote(uuid[], double precision, double precision, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_transition(uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_request_lab(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_confirm_payment(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_lab_respond(uuid, uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_lab_timeouts() FROM PUBLIC, anon, authenticated;

-- ── 8. Orders created directly by the mobile apps ───────────
-- Older app builds insert with status 'ordered' and pick a lab. Those orders
-- now enter the same flow: a doctor's order waits for the patient's approval,
-- a patient's order is a draft they finish on the web. Payment fields can't
-- be set from the apps.
-- Not SECURITY DEFINER: current_user must stay the caller's role so app
-- inserts (authenticated) can be told apart from server routes (service_role).
CREATE OR REPLACE FUNCTION public.investigation_orders_before_insert()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_tests jsonb := '[]';
  t jsonb;
  v_platform uuid;
BEGIN
  -- Fill platform_test_id on each test from its catalogue row
  FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.tests, '[]'::jsonb)) LOOP
    v_platform := NULLIF(t->>'platform_test_id', '')::uuid;
    IF v_platform IS NULL AND t->>'catalogue_id' IS NOT NULL THEN
      SELECT CASE WHEN scope = 'platform' THEN id ELSE platform_test_id END INTO v_platform
      FROM investigation_catalogue WHERE id = (t->>'catalogue_id')::uuid;
    END IF;
    v_tests := v_tests || jsonb_build_array(t || jsonb_build_object('platform_test_id', v_platform));
  END LOOP;
  NEW.tests := v_tests;

  IF current_user IN ('authenticated', 'anon') THEN
    NEW.payment_status := 'unpaid';
    NEW.amount_paid := NULL; NEW.paid_at := NULL; NEW.payment_reference := NULL;
    NEW.tests_total := NULL; NEW.collection_fee := NULL; NEW.service_charge := NULL; NEW.total_amount := NULL;
    NEW.lab_partner_id := NULL;
    NEW.status := CASE WHEN NEW.provider_id IS NOT NULL THEN 'awaiting_patient_approval' ELSE 'draft' END;
  ELSIF NEW.status = 'ordered' THEN
    NEW.status := CASE WHEN NEW.provider_id IS NOT NULL THEN 'awaiting_patient_approval' ELSE 'draft' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigation_orders_before_insert ON investigation_orders;
CREATE TRIGGER investigation_orders_before_insert BEFORE INSERT ON investigation_orders
  FOR EACH ROW EXECUTE FUNCTION public.investigation_orders_before_insert();

CREATE OR REPLACE FUNCTION public.investigation_orders_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO investigation_order_events (order_id, from_status, to_status, actor_id, actor_role, note)
  VALUES (NEW.id, NULL, NEW.status,
    COALESCE((SELECT user_id FROM providers WHERE id = NEW.provider_id), NEW.patient_id),
    CASE WHEN NEW.provider_id IS NOT NULL THEN 'doctor' ELSE 'patient' END, 'Order created');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS investigation_orders_after_insert ON investigation_orders;
CREATE TRIGGER investigation_orders_after_insert AFTER INSERT ON investigation_orders
  FOR EACH ROW EXECUTE FUNCTION public.investigation_orders_after_insert();

-- ── 9. Care episodes wait for result review ─────────────────
ALTER TABLE care_episodes ADD COLUMN IF NOT EXISTS investigation_handover_note text;

CREATE OR REPLACE FUNCTION public.care_episode_close_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('closed', 'resolved') AND OLD.status NOT IN ('closed', 'resolved')
     AND NULLIF(trim(COALESCE(NEW.investigation_handover_note, '')), '') IS NULL
     AND EXISTS (
       SELECT 1 FROM investigation_orders o
       WHERE o.care_episode_id = NEW.id
         AND o.status NOT IN ('reviewed', 'completed', 'cancelled', 'declined_by_patient')
     ) THEN
    RAISE EXCEPTION 'This care episode has investigations still in progress or awaiting review. Review them, or add a handover note, before closing it.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_episode_close_guard ON care_episodes;
CREATE TRIGGER care_episode_close_guard BEFORE UPDATE OF status ON care_episodes
  FOR EACH ROW EXECUTE FUNCTION public.care_episode_close_guard();

-- ── 10. Notifications for the new statuses (replaces 065's version) ─
-- No result values or test names go into notifications.
CREATE OR REPLACE FUNCTION public.notify_investigation_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab   text;
  v_link  text := '/dashboard/investigations/' || NEW.id;
  v_first text;
  v_doctor uuid := provider_user(NEW.provider_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'awaiting_patient_approval' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your doctor requested tests',
        'Review the tests and the cost, then approve and pay to arrange collection.', v_link, 'patient');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.lab_partner_id IS NOT DISTINCT FROM OLD.lab_partner_id THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_lab FROM lab_partners WHERE id = NEW.lab_partner_id;
  v_lab := COALESCE(v_lab, 'The lab');
  SELECT split_part(COALESCE(name, 'your patient'), ' ', 1) INTO v_first FROM users WHERE id = NEW.patient_id;

  CASE NEW.status
    WHEN 'paid_awaiting_lab' THEN
      PERFORM notify(NEW.patient_id, 'payments', 'Payment received for your tests', 'We are confirming a lab for your sample collection.', v_link, 'patient');
    WHEN 'lab_requested' THEN
      PERFORM notify_facility('lab', NEW.lab_partner_id, 'orders', 'New test request',
        'Accept or decline within 30 minutes, or it moves to another lab.', '/lab-portal/dashboard/' || NEW.id);
    WHEN 'lab_accepted' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_lab || ' accepted your tests',
        CASE WHEN NEW.collection_method = 'doctor' THEN 'Your sample is on its way to the lab.' ELSE 'They will confirm a time to collect your sample.' END, v_link, 'patient');
    WHEN 'collection_scheduled' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Sample collection booked',
        'Open StreetdocMD to see when the collector will arrive.', v_link, 'patient');
    WHEN 'sample_collected' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your sample was collected', 'We will let you know when results are ready.', v_link, 'patient', '{push}');
    WHEN 'results_uploaded' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your test results are ready',
        'Open StreetdocMD to view them securely.', v_link, 'patient');
    WHEN 'doctor_review_pending' THEN
      PERFORM notify(v_doctor, 'orders',
        CASE WHEN NEW.has_critical THEN 'Urgent: results need your review' ELSE 'Results ready for ' || COALESCE(v_first, 'your patient') END,
        'Review the results you ordered and record next steps.', '/dashboard/investigations/' || NEW.id, 'provider');
    WHEN 'reviewed', 'follow_up_required' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your doctor reviewed your results',
        'Open StreetdocMD to read their notes and next steps.', v_link, 'patient');
    WHEN 'exception' THEN
      PERFORM notify_admins('Investigation needs attention', COALESCE(NEW.exception_reason, 'An investigation order needs operations follow up.'), '/dashboard/labs');
    ELSE NULL;
  END CASE;

  IF NEW.status = 'results_uploaded' AND NEW.has_critical THEN
    PERFORM notify_admins('Critical result uploaded', 'A lab marked a result as critical. Make sure the patient is contacted.', '/dashboard/labs');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;
