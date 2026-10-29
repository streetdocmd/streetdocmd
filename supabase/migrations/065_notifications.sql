-- ============================================================
-- Migration 065: notifications by email, push and in-app inbox
--
-- Every event writes one row to notifications through public.notify().
-- Database triggers raise the events, so a change made by any app (web,
-- Expo, server route or SQL) notifies the same way.
--
-- Delivery: an AFTER INSERT trigger calls the send-notification Edge
-- Function through pg_net with the row id. The function claims the row
-- (pending -> sending), sends branded email (Resend) and push (Expo and
-- web push) per the user's preferences, and records the result. A pg_cron
-- sweep every 5 minutes retries rows still pending. The function only ever
-- sends rows already in this table, so it needs no caller secret.
--
-- Existing SMS (notifications_queue / process-notifications) is unchanged.
--
--   notifications            one row per message per user; the inbox
--   push_subscriptions       Expo push tokens and browser push subscriptions
--   notification_preferences per-category email and push switches
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Tables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- visits, orders, payments, account, reviews, admin
  category     text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  -- path inside the app named by `app`; the function builds the full URL
  link         text,
  app          text NOT NULL CHECK (app IN ('patient', 'provider', 'pharmacy', 'lab', 'hospital', 'admin')),
  channels     text[] NOT NULL DEFAULT '{email,push}',
  data         jsonb NOT NULL DEFAULT '{}',
  read_at      timestamptz,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'done')),
  email_status text,
  push_status  text,
  attempts     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_pending_idx ON notifications (created_at) WHERE status <> 'done';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own_read ON notifications;
CREATE POLICY notifications_own_read ON notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS notifications_own_mark_read ON notifications;
CREATE POLICY notifications_own_mark_read ON notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- Users may only change read_at
REVOKE UPDATE ON notifications FROM authenticated, anon;
GRANT UPDATE (read_at) ON notifications TO authenticated;
REVOKE INSERT, DELETE ON notifications FROM authenticated, anon;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('expo', 'web')),
  -- Expo push token, or the browser subscription endpoint
  token        text NOT NULL UNIQUE,
  -- web push only: { p256dh, auth }
  keys         jsonb,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- { "orders": { "email": false, "push": true }, ... }; missing means on
  prefs      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_own ON notification_preferences;
CREATE POLICY notification_preferences_own ON notification_preferences FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Live unread counts in the apps
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

-- Where the Edge Function lives. Not exposed: RLS on, no policies, no grants.
CREATE TABLE IF NOT EXISTS notification_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_config FROM anon, authenticated;
INSERT INTO notification_config (key, value)
VALUES ('function_url', 'https://jumxltlpxdsksywuthfh.supabase.co/functions/v1/send-notification')
ON CONFLICT (key) DO NOTHING;

-- ── Delivery hook ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notifications_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  SELECT value INTO v_url FROM notification_config WHERE key = 'function_url';
  IF v_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('id', NEW.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the event that raised the notification; the sweep retries
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notifications_dispatch ON notifications;
CREATE TRIGGER notifications_dispatch
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_dispatch();

-- Retry anything still pending after a minute
DO $$
BEGIN
  PERFORM cron.unschedule('notifications-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'notifications-sweep',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.notification_config WHERE key = 'function_url'),
      body := '{"sweep": true}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    )
    WHERE EXISTS (
      SELECT 1 FROM public.notifications
      WHERE status <> 'done' AND attempts < 5 AND created_at < now() - interval '1 minute'
    );
  $$
);

-- ── Raising notifications ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify(
  p_user uuid, p_category text, p_title text, p_body text,
  p_link text, p_app text, p_channels text[] DEFAULT '{email,push}', p_data jsonb DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO notifications (user_id, category, title, body, link, app, channels, data)
  VALUES (p_user, p_category, p_title, p_body, p_link, p_app, p_channels, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify failed: %', SQLERRM;
END;
$$;

-- Every staff account of a pharmacy, lab or hospital
CREATE OR REPLACE FUNCTION public.notify_facility(
  p_type text, p_partner uuid, p_category text, p_title text, p_body text, p_link text,
  p_channels text[] DEFAULT '{email,push}'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_sql text := CASE p_type
    WHEN 'pharmacy' THEN 'SELECT user_id FROM pharmacy_staff WHERE pharmacy_partner_id = $1'
    WHEN 'lab' THEN 'SELECT user_id FROM lab_staff WHERE lab_partner_id = $1'
    ELSE 'SELECT user_id FROM hospital_staff WHERE hospital_partner_id = $1' END;
BEGIN
  IF p_partner IS NULL THEN RETURN; END IF;
  FOR r IN EXECUTE v_sql USING p_partner LOOP
    PERFORM public.notify(r.user_id, p_category, p_title, p_body, p_link, p_type, p_channels);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_facility failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(p_title text, p_body text, p_link text, p_channels text[] DEFAULT '{email,push}')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM users WHERE role = 'admin' LOOP
    PERFORM public.notify(r.id, 'admin', p_title, p_body, p_link, 'admin', p_channels);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_user(p_provider uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT user_id FROM providers WHERE id = p_provider $$;

REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text, text, text, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_facility(text, uuid, text, text, text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provider_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_dispatch() FROM PUBLIC, anon, authenticated;

-- ── Visits ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pname text;
  v_link  text := '/dashboard/book/tracking/' || NEW.id;
BEGIN
  SELECT name INTO v_pname FROM providers WHERE id = NEW.provider_id;
  v_pname := COALESCE(v_pname, 'Your provider');

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'paid' THEN
        PERFORM notify(NEW.patient_id, 'payments', 'Payment received',
          'Thanks, your payment went through. We''re matching you with a provider now.', v_link, 'patient');
      WHEN 'accepted' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' accepted your visit',
          'You can follow their progress and contact them from your visit page.', v_link, 'patient');
      WHEN 'en_route' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' is on the way',
          'Track them live from your visit page.', v_link, 'patient', '{push}');
      WHEN 'arrived' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' has arrived',
          'Your provider is at your address.', v_link, 'patient', '{push}');
      WHEN 'completed' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'Your visit is complete',
          'Your visit record is ready. Tell us how it went with a quick rating.', '/dashboard/book/rate/' || NEW.id, 'patient');
      WHEN 'cancelled' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'Your visit was cancelled',
          'If you paid, we''ll refund you. You can book again at any time.', '/dashboard/bookings', 'patient');
        IF NEW.provider_id IS NOT NULL AND OLD.status IN ('accepted', 'en_route', 'arrived') THEN
          PERFORM notify(provider_user(NEW.provider_id), 'visits', 'A visit was cancelled',
            'The patient cancelled a visit you had accepted. You don''t need to travel.', '/dashboard', 'provider');
        END IF;
      WHEN 'expired', 'provider_declined' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'We couldn''t find a provider',
          'No provider was free for your request. If you paid, we''ll refund you. Please try again soon.', '/dashboard/bookings', 'patient');
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.refund_status = 'due' AND OLD.refund_status IS DISTINCT FROM 'due' THEN
    PERFORM notify_admins('Refund due', 'A paid visit was cancelled and needs a refund.', '/dashboard/finance');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bookings_notify ON bookings;
CREATE TRIGGER bookings_notify
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_change();

-- A provider is offered a visit; they have minutes to respond, so push only
CREATE OR REPLACE FUNCTION public.notify_dispatch_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify(provider_user(NEW.provider_id), 'visits', 'New visit request',
    'A patient near you needs a visit. Open StreetdocMD to accept before it expires.', '/dashboard', 'provider', '{push}',
    jsonb_build_object('booking_id', NEW.booking_id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_queue_notify ON dispatch_queue;
CREATE TRIGGER dispatch_queue_notify
  AFTER INSERT ON dispatch_queue
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatch_offer();

-- ── Medicine orders ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_prescription_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ph   text;
  v_link text := '/dashboard/medications/' || NEW.id;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  SELECT name INTO v_ph FROM pharmacy_partners WHERE id = NEW.pharmacy_partner_id;
  v_ph := COALESCE(v_ph, 'Your pharmacy');

  CASE NEW.status
    WHEN 'sent' THEN
      PERFORM notify_facility('pharmacy', NEW.pharmacy_partner_id, 'orders', 'New medicine order',
        'A paid order is waiting for you to confirm and pack.', '/pharmacy-portal/dashboard/' || NEW.id);
    WHEN 'confirmed' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_ph || ' confirmed your order', 'They''re preparing your medicines.', v_link, 'patient');
    WHEN 'dispatched' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your medicines are on the way', v_ph || ' has sent your order out for delivery.', v_link, 'patient');
    WHEN 'delivered' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your medicines were delivered',
        'How was your order from ' || v_ph || '? Leave a quick rating.', '/dashboard/rate/pharmacy/' || NEW.id, 'patient');
    WHEN 'cancelled' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your medicine order was cancelled',
        'If you paid, we''ll refund you. Contact us if you have questions.', v_link, 'patient');
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prescription_orders_notify ON prescription_orders;
CREATE TRIGGER prescription_orders_notify
  AFTER INSERT OR UPDATE ON prescription_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_prescription_order();

-- ── Lab orders ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_investigation_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab  text;
  v_link text := '/dashboard/book/lab-investigations/tracking/' || NEW.id;
  v_first text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_facility('lab', NEW.lab_partner_id, 'orders', 'New test order',
      'A new test order is waiting for you to confirm.', '/lab-portal/dashboard/' || NEW.id);
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

  SELECT name INTO v_lab FROM lab_partners WHERE id = NEW.lab_partner_id;
  v_lab := COALESCE(v_lab, 'The lab');

  CASE NEW.status
    WHEN 'confirmed' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_lab || ' confirmed your tests', 'They''ll arrange your sample collection.', v_link, 'patient');
    WHEN 'sample_collector_dispatched' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'A sample collector is on the way', v_lab || ' has sent someone to take your sample.', v_link, 'patient', '{push}');
    WHEN 'resulted' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your test results are ready',
        'Open StreetdocMD to see your results from ' || v_lab || '.', v_link, 'patient');
      IF NEW.requested_by IS DISTINCT FROM 'patient' THEN
        SELECT split_part(COALESCE(name, 'your patient'), ' ', 1) INTO v_first FROM users WHERE id = NEW.patient_id;
        PERFORM notify(provider_user(NEW.provider_id), 'orders', 'Results ready for ' || COALESCE(v_first, 'your patient'),
          'Lab results you ordered are ready to review.', '/dashboard/patients/' || NEW.patient_id, 'provider');
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS investigation_orders_notify ON investigation_orders;
CREATE TRIGGER investigation_orders_notify
  AFTER INSERT OR UPDATE ON investigation_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_investigation_order();

-- ── Hospital referrals ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_hospital_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_facility('hospital', NEW.hospital_partner_id, 'orders',
      CASE WHEN NEW.urgency IN ('urgent', 'emergency') THEN 'Urgent referral received' ELSE 'New referral' END,
      'A StreetdocMD doctor has referred a patient to you.', '/hospital-portal/dashboard');
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;

  SELECT name INTO v_h FROM hospital_partners WHERE id = NEW.hospital_partner_id;
  v_h := COALESCE(v_h, 'The hospital');

  CASE NEW.status
    WHEN 'acknowledged' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_h || ' received your referral', 'They''ll contact you about next steps.', '/dashboard/my-care', 'patient');
      PERFORM notify(provider_user(NEW.provider_id), 'orders', v_h || ' acknowledged your referral', 'The hospital has received the referral letter.', '/dashboard', 'provider', '{push}');
    WHEN 'completed' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your hospital care is complete',
        'How was your care at ' || v_h || '? Leave a quick rating.', '/dashboard/rate/hospital/' || NEW.id, 'patient');
      PERFORM notify(provider_user(NEW.provider_id), 'orders', v_h || ' completed a referral', 'A patient you referred has finished their hospital care.', '/dashboard', 'provider', '{push}');
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.hospital_referrals') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hospital_referrals_notify ON hospital_referrals;
    CREATE TRIGGER hospital_referrals_notify
      AFTER INSERT OR UPDATE ON hospital_referrals
      FOR EACH ROW EXECUTE FUNCTION public.notify_hospital_referral();
  END IF;
END $$;

-- ── Reviews ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := 'New ' || NEW.rating || ' star review';
  v_body  text := COALESCE(left(NEW.comment, 140), 'A patient rated their experience.');
BEGIN
  IF TG_TABLE_NAME = 'reviews' THEN
    PERFORM notify(provider_user(NEW.provider_id), 'reviews', v_title, v_body, '/dashboard/reviews', 'provider');
  ELSE
    PERFORM notify_facility(NEW.facility_type, NEW.facility_id, 'reviews', v_title, v_body, '/' || NEW.facility_type || '-portal/reviews');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_notify ON reviews;
CREATE TRIGGER reviews_notify AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_review();
DROP TRIGGER IF EXISTS facility_reviews_notify ON facility_reviews;
CREATE TRIGGER facility_reviews_notify AFTER INSERT ON facility_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_review();

-- ── Payouts ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt text := '₦' || to_char(NEW.amount, 'FM999,999,999');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins('Payout requested', 'A provider asked to withdraw ' || v_amt || '.', '/dashboard/finance');
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  CASE NEW.status
    WHEN 'approved' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout approved', 'Your withdrawal of ' || v_amt || ' is approved and will be sent on the payout day.', '/dashboard/earnings', 'provider');
    WHEN 'processed' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout sent', v_amt || ' has been sent to your bank account.', '/dashboard/earnings', 'provider');
    WHEN 'failed' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout failed', 'We couldn''t send ' || v_amt || '. Check your bank details and try again.', '/dashboard/earnings', 'provider');
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS withdrawals_notify ON withdrawals;
CREATE TRIGGER withdrawals_notify AFTER INSERT OR UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal();

-- ── Provider account ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_provider_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins('New provider to verify', NEW.name || ' registered and is waiting for verification.', '/dashboard/providers/' || NEW.id);
    RETURN NULL;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'verified' THEN
      PERFORM notify(NEW.user_id, 'account', 'You''re verified', 'Your StreetdocMD account is approved. Go online to start receiving visits.', '/dashboard', 'provider');
    ELSIF NEW.verification_status = 'rejected' THEN
      PERFORM notify(NEW.user_id, 'account', 'Your application wasn''t approved', 'Open StreetdocMD to see why and what you can do next.', '/onboarding/pending', 'provider');
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS providers_notify ON providers;
CREATE TRIGGER providers_notify AFTER INSERT OR UPDATE OF verification_status ON providers
  FOR EACH ROW EXECUTE FUNCTION public.notify_provider_account();

CREATE OR REPLACE FUNCTION public.notify_provider_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.review_status = 'needs_info' AND OLD.review_status IS DISTINCT FROM 'needs_info' THEN
    PERFORM notify(provider_user(NEW.provider_id), 'account', 'A document needs attention',
      COALESCE(NEW.review_note, 'Our team needs a new copy of one of your documents.'), '/onboarding/documents', 'provider');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS provider_documents_notify ON provider_documents;
CREATE TRIGGER provider_documents_notify AFTER UPDATE OF review_status ON provider_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_provider_document();

-- ── Admin alerts ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'safeguarding_alerts' THEN
    PERFORM notify_admins('Safeguarding alert', 'A clinical encounter was flagged for safeguarding review.', '/dashboard/safeguarding');
  ELSIF TG_TABLE_NAME = 'facility_applications' THEN
    PERFORM notify_admins('New facility application', 'A pharmacy, lab or hospital applied to join.', '/dashboard/facilities');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.safeguarding_alerts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS safeguarding_alerts_notify ON safeguarding_alerts;
    CREATE TRIGGER safeguarding_alerts_notify AFTER INSERT ON safeguarding_alerts
      FOR EACH ROW EXECUTE FUNCTION public.notify_admin_event();
  END IF;
  IF to_regclass('public.facility_applications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS facility_applications_notify ON facility_applications;
    CREATE TRIGGER facility_applications_notify AFTER INSERT ON facility_applications
      FOR EACH ROW EXECUTE FUNCTION public.notify_admin_event();
  END IF;
END $$;

-- Trigger functions are only called by their triggers
REVOKE ALL ON FUNCTION public.notify_booking_change(), public.notify_dispatch_offer(), public.notify_prescription_order(),
  public.notify_investigation_order(), public.notify_hospital_referral(), public.notify_review(), public.notify_withdrawal(),
  public.notify_provider_account(), public.notify_provider_document(), public.notify_admin_event()
  FROM PUBLIC, anon, authenticated;
