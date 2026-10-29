-- ============================================================
-- Migration 068: a chat and a record for every care journey
--
-- A care journey is a care_episode (migration 028). From now on:
--   * every visit belongs to one: when a provider accepts a visit that isn't
--     already part of a journey, a new journey starts and they lead it.
--     Follow ups and visits booked from a journey join it. Lab orders,
--     medicine orders and hospital referrals from its visits join it too.
--   * care_journey_messages is its chat. Everyone caring for the patient
--     is in it: the journey's clinicians, the pharmacies, labs and hospitals
--     handling its orders, and StreetdocMD admins. They see the whole
--     thread and can write. The patient does not see it.
--   * the "Care updates" assistant (sender_role 'bot') posts every step
--     automatically: visits, prescriptions, medicine orders, tests, results
--     and reviews, referrals, follow ups, recovery and closing.
--   * the patient confirms recovery; the lead clinician then closes the
--     journey, or it closes by itself 7 days later if nothing is open.
--   * care_report_requests: patients and providers ask for the journey's
--     medical report; an admin approves or rejects it before release.
--     Admins can download any journey's report.
--
-- care_team_messages (migration 041) is copied into the new chat and kept.
-- ============================================================

-- ── 1. Journeys ─────────────────────────────────────────────
ALTER TABLE care_episodes ADD COLUMN IF NOT EXISTS recovered_at timestamptz;
ALTER TABLE care_episodes ADD COLUMN IF NOT EXISTS recovery_note text;
ALTER TABLE care_episodes ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Hospital referrals join the journey of the visit they came from
DO $$
BEGIN
  IF to_regclass('public.hospital_referrals') IS NOT NULL THEN
    ALTER TABLE hospital_referrals ADD COLUMN IF NOT EXISTS care_episode_id uuid REFERENCES care_episodes(id) ON DELETE SET NULL;
    UPDATE hospital_referrals r SET care_episode_id = b.care_episode_id
    FROM bookings b WHERE b.id = r.booking_id AND r.care_episode_id IS NULL AND b.care_episode_id IS NOT NULL;
  END IF;
END $$;

-- ── 2. Chat ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS care_journey_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  -- null for the bot
  sender_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  sender_role     text NOT NULL CHECK (sender_role IN ('bot', 'provider', 'pharmacy', 'lab', 'hospital', 'admin')),
  -- "Dr Ada Obi · Doctor", "Tunde B · Mainstay Diagnostics", "Care updates"
  sender_label    text NOT NULL,
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  kind            text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'update')),
  data            jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_journey_messages_episode_idx ON care_journey_messages(care_episode_id, created_at);

-- Who is in a journey's chat: its clinicians, the facilities handling its
-- orders (once the order has reached them), and admins. Never the patient.
CREATE OR REPLACE FUNCTION public.care_chat_access(p_episode uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS p_user)
  SELECT me.p_user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM users u WHERE u.id = p_user AND u.role = 'admin')
    OR EXISTS (SELECT 1 FROM care_team_members m JOIN providers p ON p.id = m.provider_id
               WHERE m.care_episode_id = p_episode AND p.user_id = p_user)
    OR EXISTS (SELECT 1 FROM bookings b JOIN providers p ON p.id = b.provider_id
               WHERE b.care_episode_id = p_episode AND p.user_id = p_user)
    OR EXISTS (SELECT 1 FROM care_episodes e JOIN providers p ON p.id IN (e.lead_provider_id, e.created_by)
               WHERE e.id = p_episode AND p.user_id = p_user)
    OR EXISTS (SELECT 1 FROM investigation_orders o JOIN lab_staff s ON s.lab_partner_id = o.lab_partner_id
               WHERE o.care_episode_id = p_episode AND s.user_id = p_user
                 AND o.status NOT IN ('draft', 'awaiting_patient_approval', 'declined_by_patient', 'awaiting_payment', 'payment_failed', 'paid_awaiting_lab'))
    OR EXISTS (SELECT 1 FROM prescription_orders o JOIN pharmacy_staff s ON s.pharmacy_partner_id = o.pharmacy_partner_id
               WHERE o.care_episode_id = p_episode AND s.user_id = p_user AND o.status <> 'pending_payment')
    OR (to_regclass('public.hospital_staff') IS NOT NULL AND EXISTS (
          SELECT 1 FROM hospital_referrals r JOIN hospital_staff s ON s.hospital_partner_id = r.hospital_partner_id
          WHERE r.care_episode_id = p_episode AND s.user_id = p_user))
  ) FROM me
$$;

-- Everyone in a journey's chat, for notifications
CREATE OR REPLACE FUNCTION public.care_chat_members(p_episode uuid)
RETURNS TABLE (user_id uuid, app text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.user_id, 'provider'::text FROM care_team_members m JOIN providers p ON p.id = m.provider_id
    WHERE m.care_episode_id = p_episode AND m.active
  UNION
  SELECT DISTINCT p.user_id, 'provider' FROM bookings b JOIN providers p ON p.id = b.provider_id
    WHERE b.care_episode_id = p_episode AND b.status NOT IN ('cancelled', 'expired', 'provider_declined')
  UNION
  SELECT DISTINCT s.user_id, 'lab' FROM investigation_orders o JOIN lab_staff s ON s.lab_partner_id = o.lab_partner_id
    WHERE o.care_episode_id = p_episode
      AND o.status NOT IN ('draft', 'awaiting_patient_approval', 'declined_by_patient', 'awaiting_payment', 'payment_failed', 'paid_awaiting_lab')
  UNION
  SELECT DISTINCT s.user_id, 'pharmacy' FROM prescription_orders o JOIN pharmacy_staff s ON s.pharmacy_partner_id = o.pharmacy_partner_id
    WHERE o.care_episode_id = p_episode AND o.status <> 'pending_payment'
  UNION
  SELECT DISTINCT s.user_id, 'hospital' FROM hospital_referrals r JOIN hospital_staff s ON s.hospital_partner_id = r.hospital_partner_id
    WHERE r.care_episode_id = p_episode
$$;

ALTER TABLE care_journey_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_journey_messages_read ON care_journey_messages;
CREATE POLICY care_journey_messages_read ON care_journey_messages FOR SELECT TO authenticated
  USING (public.care_chat_access(care_episode_id));
DROP POLICY IF EXISTS care_journey_messages_write ON care_journey_messages;
CREATE POLICY care_journey_messages_write ON care_journey_messages FOR INSERT TO authenticated
  WITH CHECK (public.care_chat_access(care_episode_id) AND kind = 'message');

-- Who wrote it is set here, never by the sender: their account, role and name
CREATE OR REPLACE FUNCTION public.care_sender_identity(p_uid uuid, OUT sender_role text, OUT sender_label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_role text;
BEGIN
  SELECT name, role INTO v_name, v_role FROM users WHERE id = p_uid;
  IF v_role = 'admin' THEN
    sender_role := 'admin';
    sender_label := COALESCE(v_name, 'StreetdocMD') || ' · StreetdocMD';
  ELSIF v_role = 'lab_staff' THEN
    sender_role := 'lab';
    SELECT COALESCE(v_name, 'Lab') || ' · ' || l.name INTO sender_label FROM lab_staff s JOIN lab_partners l ON l.id = s.lab_partner_id WHERE s.user_id = p_uid LIMIT 1;
  ELSIF v_role = 'pharmacy_staff' THEN
    sender_role := 'pharmacy';
    SELECT COALESCE(v_name, 'Pharmacy') || ' · ' || ph.name INTO sender_label FROM pharmacy_staff s JOIN pharmacy_partners ph ON ph.id = s.pharmacy_partner_id WHERE s.user_id = p_uid LIMIT 1;
  ELSIF v_role = 'hospital_staff' THEN
    sender_role := 'hospital';
    SELECT COALESCE(v_name, 'Hospital') || ' · ' || h.name INTO sender_label FROM hospital_staff s JOIN hospital_partners h ON h.id = s.hospital_partner_id WHERE s.user_id = p_uid LIMIT 1;
  ELSE
    sender_role := 'provider';
    SELECT p.name || ' · ' || initcap(COALESCE(p.profession, 'provider')) INTO sender_label FROM providers p WHERE p.user_id = p_uid;
  END IF;
  sender_label := COALESCE(sender_label, v_name, 'Care team');
END;
$$;
REVOKE ALL ON FUNCTION public.care_sender_identity(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.care_sender_identity_for_caller(OUT sender_role text, OUT sender_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.sender_role, i.sender_label FROM public.care_sender_identity(auth.uid()) i
$$;

CREATE OR REPLACE FUNCTION public.care_episode_status(p_episode uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM care_episodes WHERE id = p_episode
$$;

-- Not SECURITY DEFINER: current_user tells app users (authenticated) apart
-- from the bot and server routes, which set the sender themselves.
CREATE OR REPLACE FUNCTION public.care_journey_message_sender()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_id record;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF public.care_episode_status(NEW.care_episode_id) IN ('closed', 'resolved') THEN
    RAISE EXCEPTION 'This care journey is closed.';
  END IF;
  SELECT * INTO v_id FROM public.care_sender_identity_for_caller();
  NEW.sender_user_id := auth.uid();
  NEW.sender_role := v_id.sender_role;
  NEW.sender_label := v_id.sender_label;
  NEW.kind := 'message';
  NEW.data := '{}';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_journey_message_sender ON care_journey_messages;
CREATE TRIGGER care_journey_message_sender BEFORE INSERT ON care_journey_messages
  FOR EACH ROW EXECUTE FUNCTION public.care_journey_message_sender();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE care_journey_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

-- Old provider-only messages move into the journey chat
INSERT INTO care_journey_messages (care_episode_id, sender_user_id, sender_role, sender_label, body, created_at)
SELECT m.care_episode_id, p.user_id, 'provider', p.name || ' · ' || initcap(COALESCE(p.profession, 'provider')), m.message, m.created_at
FROM care_team_messages m JOIN providers p ON p.id = m.provider_id
WHERE NOT EXISTS (
  SELECT 1 FROM care_journey_messages x
  WHERE x.care_episode_id = m.care_episode_id AND x.created_at = m.created_at AND x.body = m.message
);

-- ── 3. The bot ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_journey_post(p_episode uuid, p_body text, p_data jsonb DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_episode IS NULL OR p_body IS NULL THEN RETURN; END IF;
  INSERT INTO care_journey_messages (care_episode_id, sender_user_id, sender_role, sender_label, body, kind, data)
  VALUES (p_episode, NULL, 'bot', 'Care updates', left(p_body, 4000), 'update', COALESCE(p_data, '{}'));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'care_journey_post failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_label(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT initcap(replace(COALESCE(p, 'visit'), '_', ' ')) $$;

-- New chat messages reach everyone else in the journey (push only; the bot's
-- updates already notify through their own events)
CREATE OR REPLACE FUNCTION public.care_journey_message_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_link text;
BEGIN
  IF NEW.kind <> 'message' THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM public.care_chat_members(NEW.care_episode_id) LOOP
    IF r.user_id IS DISTINCT FROM NEW.sender_user_id THEN
      v_link := CASE r.app WHEN 'provider' THEN '/dashboard/journeys/' ELSE '/' || r.app || '-portal/journeys/' END || NEW.care_episode_id;
      PERFORM notify(r.user_id, 'visits', 'New message from ' || split_part(NEW.sender_label, ' · ', 1),
        left(NEW.body, 120), v_link, r.app, '{push}');
    END IF;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'care_journey_message_notify failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS care_journey_message_notify ON care_journey_messages;
CREATE TRIGGER care_journey_message_notify AFTER INSERT ON care_journey_messages
  FOR EACH ROW EXECUTE FUNCTION public.care_journey_message_notify();

-- ── 4. Every visit has a journey ────────────────────────────
-- On acceptance: start a journey led by this provider, or (if the visit was
-- booked into one) add them to its care team.
CREATE OR REPLACE FUNCTION public.bookings_ensure_journey()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_episode uuid;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.provider_id IS NOT NULL THEN
    IF NEW.care_episode_id IS NULL THEN
      INSERT INTO care_episodes (patient_id, title, reason, status, lead_provider_id, created_by)
      VALUES (NEW.patient_id, public.service_label(NEW.service_type), NEW.notes, 'active', NEW.provider_id, NEW.provider_id)
      RETURNING id INTO v_episode;
      NEW.care_episode_id := v_episode;
      INSERT INTO care_team_members (care_episode_id, provider_id, is_lead) VALUES (v_episode, NEW.provider_id, true)
      ON CONFLICT DO NOTHING;
    ELSIF NOT EXISTS (SELECT 1 FROM care_team_members WHERE care_episode_id = NEW.care_episode_id AND provider_id = NEW.provider_id AND active) THEN
      INSERT INTO care_team_members (care_episode_id, provider_id, is_lead) VALUES (NEW.care_episode_id, NEW.provider_id, false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bookings_ensure_journey failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_ensure_journey ON bookings;
CREATE TRIGGER bookings_ensure_journey BEFORE UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_ensure_journey();

-- Visits already under way get a journey now
DO $$
DECLARE b record; v_episode uuid;
BEGIN
  FOR b IN SELECT * FROM bookings WHERE care_episode_id IS NULL AND provider_id IS NOT NULL
             AND status IN ('accepted', 'en_route', 'arrived', 'in_progress') LOOP
    INSERT INTO care_episodes (patient_id, title, reason, status, lead_provider_id, created_by)
    VALUES (b.patient_id, public.service_label(b.service_type), b.notes, 'active', b.provider_id, b.provider_id)
    RETURNING id INTO v_episode;
    UPDATE bookings SET care_episode_id = v_episode WHERE id = b.id;
    INSERT INTO care_team_members (care_episode_id, provider_id, is_lead) VALUES (v_episode, b.provider_id, true) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Orders from a visit join its journey
CREATE OR REPLACE FUNCTION public.fill_care_episode_from_booking()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.care_episode_id IS NULL THEN
    IF TG_TABLE_NAME = 'prescription_orders' THEN
      SELECT b.care_episode_id INTO NEW.care_episode_id FROM visits v JOIN bookings b ON b.id = v.booking_id WHERE v.id = NEW.visit_id;
    ELSE
      SELECT care_episode_id INTO NEW.care_episode_id FROM bookings WHERE id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigation_orders_fill_episode ON investigation_orders;
CREATE TRIGGER investigation_orders_fill_episode BEFORE INSERT ON investigation_orders
  FOR EACH ROW EXECUTE FUNCTION public.fill_care_episode_from_booking();
DROP TRIGGER IF EXISTS prescription_orders_fill_episode ON prescription_orders;
CREATE TRIGGER prescription_orders_fill_episode BEFORE INSERT ON prescription_orders
  FOR EACH ROW EXECUTE FUNCTION public.fill_care_episode_from_booking();
DO $$
BEGIN
  IF to_regclass('public.hospital_referrals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hospital_referrals_fill_episode ON hospital_referrals;
    CREATE TRIGGER hospital_referrals_fill_episode BEFORE INSERT ON hospital_referrals
      FOR EACH ROW EXECUTE FUNCTION public.fill_care_episode_from_booking();
  END IF;
END $$;

-- ── 5. Updates for each step ────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_updates_booking()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_service text := public.service_label(NEW.service_type);
BEGIN
  IF NEW.care_episode_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  SELECT name INTO v_name FROM providers WHERE id = NEW.provider_id;
  v_name := COALESCE(v_name, 'The provider');
  PERFORM care_journey_post(NEW.care_episode_id, CASE NEW.status
    WHEN 'accepted' THEN v_name || ' accepted the ' || lower(v_service) || ' visit.'
    WHEN 'en_route' THEN v_name || ' is on the way to the patient.'
    WHEN 'arrived' THEN v_name || ' arrived at the patient''s address.'
    WHEN 'in_progress' THEN v_name || ' started the ' || lower(v_service) || ' visit.'
    WHEN 'completed' THEN 'The ' || lower(v_service) || ' visit with ' || v_name || ' is complete.'
    WHEN 'cancelled' THEN 'The ' || lower(v_service) || ' visit was cancelled.'
    ELSE NULL END, jsonb_build_object('booking_id', NEW.id, 'status', NEW.status));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_booking ON bookings;
CREATE TRIGGER care_updates_booking AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_booking();

CREATE OR REPLACE FUNCTION public.care_updates_prescription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_episode uuid;
  v_name text;
  v_drugs text;
BEGIN
  SELECT care_episode_id INTO v_episode FROM bookings WHERE id = NEW.booking_id;
  SELECT name INTO v_name FROM providers WHERE id = NEW.provider_id;
  SELECT string_agg(COALESCE(d->>'name', d->>'drug_name'), ', ') INTO v_drugs FROM jsonb_array_elements(COALESCE(NEW.drugs, '[]')) d;
  PERFORM care_journey_post(v_episode, COALESCE(v_name, 'The doctor') || ' prescribed ' || COALESCE(v_drugs, 'medicines') || '.',
    jsonb_build_object('prescription_id', NEW.id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_prescription ON prescriptions;
CREATE TRIGGER care_updates_prescription AFTER INSERT ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_prescription();

CREATE OR REPLACE FUNCTION public.care_updates_medicine_order()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ph text;
BEGIN
  IF NEW.care_episode_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status) THEN RETURN NULL; END IF;
  SELECT name INTO v_ph FROM pharmacy_partners WHERE id = NEW.pharmacy_partner_id;
  v_ph := COALESCE(v_ph, 'the pharmacy');
  PERFORM care_journey_post(NEW.care_episode_id, CASE NEW.status
    WHEN 'pending_payment' THEN 'A medicine order for ' || v_ph || ' is waiting for the patient to pay.'
    WHEN 'sent' THEN 'The patient paid; the medicine order was sent to ' || v_ph || '.'
    WHEN 'confirmed' THEN v_ph || ' confirmed the medicine order.'
    WHEN 'dispensing' THEN v_ph || ' is preparing the medicines.'
    WHEN 'dispatched' THEN v_ph || ' sent the medicines out for delivery.'
    WHEN 'delivered' THEN 'The medicines from ' || v_ph || ' were delivered.'
    WHEN 'cancelled' THEN 'The medicine order with ' || v_ph || ' was cancelled.'
    ELSE NULL END, jsonb_build_object('prescription_order_id', NEW.id, 'status', NEW.status));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_medicine_order ON prescription_orders;
CREATE TRIGGER care_updates_medicine_order AFTER INSERT OR UPDATE OF status ON prescription_orders
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_medicine_order();

-- Tests: from the investigation event log (migration 067)
CREATE OR REPLACE FUNCTION public.care_updates_investigation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o investigation_orders%ROWTYPE;
  v_lab text;
  v_doc text;
  v_tests text;
BEGIN
  IF NEW.to_status IS NULL OR NEW.to_status IS NOT DISTINCT FROM NEW.from_status THEN RETURN NULL; END IF;
  SELECT * INTO o FROM investigation_orders WHERE id = NEW.order_id;
  IF o.care_episode_id IS NULL THEN RETURN NULL; END IF;
  SELECT name INTO v_lab FROM lab_partners WHERE id = o.lab_partner_id;
  SELECT name INTO v_doc FROM providers WHERE id = o.provider_id;
  SELECT string_agg(t->>'test_name', ', ') INTO v_tests FROM jsonb_array_elements(COALESCE(o.tests, '[]')) t;
  v_lab := COALESCE(v_lab, 'The lab');
  PERFORM care_journey_post(o.care_episode_id, CASE NEW.to_status
    WHEN 'awaiting_patient_approval' THEN COALESCE(v_doc, 'The doctor') || ' requested tests: ' || COALESCE(v_tests, 'lab tests') || '. Waiting for the patient to approve and pay.'
      || CASE WHEN o.collection_method = 'doctor' THEN ' The sample was taken during the visit.' ELSE '' END
    WHEN 'draft' THEN 'The patient started a test order: ' || COALESCE(v_tests, 'lab tests') || '.'
    WHEN 'declined_by_patient' THEN 'The patient declined the requested tests.'
    WHEN 'paid_awaiting_lab' THEN 'The patient paid for the tests: ' || COALESCE(v_tests, 'lab tests') || '.'
    WHEN 'lab_requested' THEN v_lab || ' has been asked to take the tests.'
    WHEN 'lab_accepted' THEN v_lab || ' accepted the tests.'
    WHEN 'collection_scheduled' THEN v_lab || ' booked the sample collection' || COALESCE(' for ' || to_char(o.collection_scheduled_at AT TIME ZONE 'Africa/Lagos', 'Dy DD Mon, HH12:MI am'), '') || '.'
    WHEN 'sample_collected' THEN 'The sample was collected' || COALESCE(' by ' || o.collected_by, '') || '.'
    WHEN 'in_transit' THEN 'The sample is on its way to ' || v_lab || '.'
    WHEN 'received_at_lab' THEN v_lab || ' received the sample.'
    WHEN 'analysis_in_progress' THEN v_lab || ' started the analysis.'
    WHEN 'results_uploaded' THEN v_lab || ' uploaded the results' || CASE WHEN o.has_critical THEN '. One or more results are marked critical.' ELSE '.' END
    WHEN 'reviewed' THEN COALESCE(v_doc, 'The doctor') || ' reviewed the results' || COALESCE(': ' || left(o.review_interpretation, 300), '.')
    WHEN 'follow_up_required' THEN COALESCE(v_doc, 'The doctor') || ' reviewed the results and asked for follow up' || COALESCE(': ' || left(o.review_interpretation, 300), '.')
    WHEN 'completed' THEN 'The test order is complete.'
    WHEN 'exception' THEN 'No lab could take the tests yet. StreetdocMD operations is following up.'
    WHEN 'cancelled' THEN 'The test order was cancelled.'
    ELSE NULL END, jsonb_build_object('investigation_order_id', o.id, 'status', NEW.to_status));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_investigation ON investigation_order_events;
CREATE TRIGGER care_updates_investigation AFTER INSERT ON investigation_order_events
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_investigation();

CREATE OR REPLACE FUNCTION public.care_updates_referral()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h text;
BEGIN
  IF NEW.care_episode_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status) THEN RETURN NULL; END IF;
  SELECT name INTO v_h FROM hospital_partners WHERE id = NEW.hospital_partner_id;
  v_h := COALESCE(v_h, 'the hospital');
  PERFORM care_journey_post(NEW.care_episode_id, CASE
    WHEN TG_OP = 'INSERT' THEN 'The patient was referred to ' || v_h || ' (' || COALESCE(NEW.urgency, 'routine') || ')' || COALESCE(': ' || left(NEW.reason, 200), '.')
    WHEN NEW.status = 'acknowledged' THEN v_h || ' acknowledged the referral.'
    WHEN NEW.status = 'in_progress' THEN v_h || ' is caring for the patient.'
    WHEN NEW.status = 'completed' THEN v_h || ' completed the referral.'
    ELSE NULL END, jsonb_build_object('referral_id', NEW.id, 'status', NEW.status));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DO $$
BEGIN
  IF to_regclass('public.hospital_referrals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS care_updates_referral ON hospital_referrals;
    CREATE TRIGGER care_updates_referral AFTER INSERT OR UPDATE OF status ON hospital_referrals
      FOR EACH ROW EXECUTE FUNCTION public.care_updates_referral();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.care_updates_follow_up()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM providers WHERE id = NEW.created_by;
  PERFORM care_journey_post(NEW.care_episode_id,
    COALESCE(v_name, 'The care team') || ' set a ' || replace(NEW.follow_up_type, '_', ' ') || ' follow up for '
      || to_char(NEW.follow_up_date, 'Dy DD Mon YYYY') || COALESCE(': ' || left(NEW.reason, 200), '.'),
    jsonb_build_object('follow_up_id', NEW.id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_follow_up ON follow_ups;
CREATE TRIGGER care_updates_follow_up AFTER INSERT ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_follow_up();

CREATE OR REPLACE FUNCTION public.care_updates_episode()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead uuid;
BEGIN
  IF NEW.recovered_at IS NOT NULL AND OLD.recovered_at IS NULL THEN
    PERFORM care_journey_post(NEW.id, 'The patient confirmed they have recovered' || COALESCE(': "' || left(NEW.recovery_note, 300) || '"', '.')
      || ' The lead clinician can now close this journey; it closes by itself in 7 days if nothing is open.');
    SELECT user_id INTO v_lead FROM providers WHERE id = NEW.lead_provider_id;
    PERFORM notify(v_lead, 'visits', 'Your patient says they have recovered',
      'Review the care journey and close it when everything is done.', '/dashboard/journeys/' || NEW.id, 'provider');
  END IF;
  IF NEW.status IN ('closed', 'resolved') AND OLD.status NOT IN ('closed', 'resolved') THEN
    PERFORM care_journey_post(NEW.id, 'This care journey was closed. The chat is now read only.');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_updates_episode ON care_episodes;
CREATE TRIGGER care_updates_episode AFTER UPDATE ON care_episodes
  FOR EACH ROW EXECUTE FUNCTION public.care_updates_episode();

-- ── 6. Closing by itself after recovery ─────────────────────
-- 7 days after the patient confirmed recovery, close journeys with no visit
-- or order still open (the review guard from migration 067 still applies).
CREATE OR REPLACE FUNCTION public.close_recovered_journeys()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT e.id FROM care_episodes e
           WHERE e.recovered_at < now() - interval '7 days' AND e.status NOT IN ('closed', 'resolved')
             AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.care_episode_id = e.id AND b.status IN ('pending_payment', 'paid', 'accepted', 'en_route', 'arrived', 'in_progress'))
             AND NOT EXISTS (SELECT 1 FROM prescription_orders o WHERE o.care_episode_id = e.id AND o.status IN ('sent', 'confirmed', 'dispensing', 'dispatched'))
  LOOP
    BEGIN
      UPDATE care_episodes SET status = 'closed', closed_at = now(), end_date = CURRENT_DATE, updated_at = now() WHERE id = r.id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN NULL;   -- results still awaiting review: stays open
    END;
  END LOOP;
  RETURN n;
END;
$$;
DO $$ BEGIN PERFORM cron.unschedule('close-recovered-journeys'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('close-recovered-journeys', '30 3 * * *', 'SELECT public.close_recovered_journeys()');

-- ── 7. Medical report requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS care_report_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_role  text NOT NULL CHECK (requester_role IN ('patient', 'provider')),
  reason          text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     uuid REFERENCES users(id),
  reviewed_at     timestamptz,
  review_note     text,
  -- the released PDF in the private care-reports bucket
  file_path       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_report_requests_status_idx ON care_report_requests(status, created_at);
ALTER TABLE care_report_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS care_report_requests_own ON care_report_requests;
CREATE POLICY care_report_requests_own ON care_report_requests FOR SELECT TO authenticated
  USING (requested_by = (SELECT auth.uid()) OR (SELECT public.get_user_role()) = 'admin');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('care-reports', 'care-reports', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.care_report_request_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins('Medical report requested', 'A ' || NEW.requester_role || ' asked for a care journey report.', '/dashboard/reports');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM notify(NEW.requested_by, 'account',
      CASE WHEN NEW.status = 'approved' THEN 'Your medical report is ready' ELSE 'Your medical report request was not approved' END,
      CASE WHEN NEW.status = 'approved' THEN 'Open StreetdocMD to download it.' ELSE COALESCE(NEW.review_note, 'Contact StreetdocMD support for details.') END,
      CASE WHEN NEW.requester_role = 'patient' THEN '/dashboard/my-care' ELSE '/dashboard/journeys/' || NEW.care_episode_id END,
      CASE WHEN NEW.requester_role = 'patient' THEN 'patient' ELSE 'provider' END);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_report_request_notify ON care_report_requests;
CREATE TRIGGER care_report_request_notify AFTER INSERT OR UPDATE ON care_report_requests
  FOR EACH ROW EXECUTE FUNCTION public.care_report_request_notify();

REVOKE ALL ON FUNCTION public.care_journey_post(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.care_chat_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_recovered_journeys() FROM PUBLIC, anon, authenticated;
