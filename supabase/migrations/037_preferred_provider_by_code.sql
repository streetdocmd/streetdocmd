-- ============================================================
-- Migration 037: Preferred provider booking by code
--
-- A patient can enter a provider's shareable code, see that provider's
-- info, and book directly with them instead of the normal nearest-match
-- dispatch. The provider is notified the same way any dispatch offer
-- already surfaces (dispatch_queue row -> "Incoming requests" on their
-- dashboard) plus a new email channel, and can accept/decline exactly
-- like today. If they decline (or the offer times out), the patient is
-- NOT silently routed to another provider automatically — the booking
-- already has payment collected upfront (payment-gated dispatch, see
-- 019), so re-dispatching it automatically would ordinarily be fine, but
-- a *preferred* provider request failing is a meaningful signal the
-- patient should see and act on, not have silently overridden. They land
-- on a distinct terminal status and choose: try a different named
-- provider, or fall back to normal nearest-available search — both reuse
-- the SAME already-paid booking row, never a new charge.
--
-- Everything below is additive: every new branch in the dispatch
-- functions is gated on `targeted_provider_id IS NOT NULL`, which is
-- NULL for every booking that exists today and every booking created by
-- every other flow — so normal dispatch behaviour is byte-for-byte
-- unchanged for the non-targeted path.
-- ============================================================

-- ── 1. PROVIDER REFERRAL CODE ──────────────────────────────────

ALTER TABLE providers ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE OR REPLACE FUNCTION generate_provider_referral_code()
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I — easy to read aloud
  code  text;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM providers WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION set_provider_referral_code()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_provider_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_set_referral_code ON providers;
CREATE TRIGGER providers_set_referral_code
  BEFORE INSERT ON providers
  FOR EACH ROW
  EXECUTE FUNCTION set_provider_referral_code();

-- Backfill existing providers
UPDATE providers SET referral_code = generate_provider_referral_code() WHERE referral_code IS NULL;

-- ── 2. BOOKINGS: TARGETED PROVIDER + DECLINED STATUS ──────────
-- Distinct from the existing preferred_provider_id (continuity-of-care
-- dispatch *reordering*, see 030_follow_ups.sql) — this one pins dispatch
-- to exactly one provider rather than nudging the normal search.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS targeted_provider_id uuid REFERENCES providers(id);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'pending_payment', 'paid', 'accepted', 'en_route', 'arrived',
  'in_progress', 'completed', 'cancelled', 'expired', 'provider_declined'
));

-- ── 3. NOTIFICATIONS QUEUE: SUPPORT A PROVIDER RECIPIENT ──────
-- Was patient-only (SMS via Termii). A provider-targeted row is emailed
-- instead, via the same processing function, now channel-aware.

ALTER TABLE notifications_queue ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE notifications_queue ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES providers(id);
ALTER TABLE notifications_queue ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'sms'
  CHECK (channel IN ('sms', 'email'));
ALTER TABLE notifications_queue ADD COLUMN IF NOT EXISTS subject text;

DO $$ BEGIN
  ALTER TABLE notifications_queue ADD CONSTRAINT notifications_queue_one_recipient_check CHECK (
    (patient_id IS NOT NULL AND provider_id IS NULL) OR
    (patient_id IS NULL AND provider_id IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. DISPATCH: TARGETED-PROVIDER BRANCH ─────────────────────

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
  prov    RECORD;
BEGIN
  IF NEW.provider_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.targeted_provider_id IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.id, NEW.targeted_provider_id, now(), now() + INTERVAL '2 minutes');

    SELECT p.name, u.email INTO prov
    FROM providers p JOIN users u ON u.id = p.user_id
    WHERE p.id = NEW.targeted_provider_id;

    IF prov.email IS NOT NULL THEN
      INSERT INTO notifications_queue (provider_id, channel, subject, message, send_at, type)
      VALUES (
        NEW.targeted_provider_id, 'email',
        'A patient has requested you directly',
        'A patient has booked you directly on StreetdocMD and is waiting for your response. Open the app to accept or decline — the request expires in 2 minutes.',
        now(), 'preferred_provider_request'
      );
    END IF;

    RETURN NEW;
  END IF;

  SELECT provider_id INTO nearest
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15, NEW.profession)
  LIMIT 1;

  IF nearest IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.id, nearest, now(), now() + INTERVAL '2 minutes');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION on_dispatch_declined()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_prov uuid;
  b         RECORD;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id AND status = 'paid';
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF b.targeted_provider_id IS NOT NULL THEN
    UPDATE bookings SET status = 'provider_declined' WHERE id = NEW.booking_id AND status = 'paid';

    INSERT INTO notifications_queue (patient_id, channel, message, send_at, type)
    VALUES (
      b.patient_id, 'sms',
      'The provider you requested wasn''t able to accept your booking. Open the app to choose another provider or search for the nearest available one.',
      now(), 'preferred_provider_declined'
    );

    RETURN NEW;
  END IF;

  SELECT provider_id INTO next_prov
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, b.profession)
  WHERE provider_id NOT IN (
    SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = NEW.booking_id
  )
  LIMIT 1;

  IF next_prov IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.booking_id, next_prov, now(), now() + INTERVAL '2 minutes');
    UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = NEW.booking_id;
  ELSE
    UPDATE bookings SET status = 'cancelled', cancelled_at = now()
    WHERE id = NEW.booking_id AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION process_expired_dispatches()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec           RECORD;
  next_prov     uuid;
  expired_count int;
BEGIN
  UPDATE dispatch_queue
  SET response = 'expired', responded_at = now()
  WHERE expires_at < now() AND response IS NULL;
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Timed-out targeted (preferred-provider) offers: same terminal state as
  -- an explicit decline, never silently handed to another provider.
  FOR rec IN
    SELECT b.id, b.patient_id
    FROM bookings b
    WHERE b.status = 'paid'
      AND b.targeted_provider_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response = 'expired'
      )
  LOOP
    UPDATE bookings SET status = 'provider_declined' WHERE id = rec.id AND status = 'paid';
    INSERT INTO notifications_queue (patient_id, channel, message, send_at, type)
    VALUES (
      rec.patient_id, 'sms',
      'The provider you requested wasn''t able to accept your booking. Open the app to choose another provider or search for the nearest available one.',
      now(), 'preferred_provider_declined'
    );
  END LOOP;

  -- For each paid, non-targeted booking whose last offer just expired, try next provider
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
    FROM bookings b
    WHERE b.status = 'paid'
      AND b.targeted_provider_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id AND dq.response = 'expired'
      )
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession)
    WHERE provider_id NOT IN (
      SELECT dq.provider_id FROM dispatch_queue dq WHERE dq.booking_id = rec.id
    )
    LIMIT 1;

    IF next_prov IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_prov, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = dispatch_attempts + 1 WHERE id = rec.id;
    ELSE
      UPDATE bookings SET status = 'cancelled', cancelled_at = now()
      WHERE id = rec.id AND status = 'paid';
    END IF;
  END LOOP;

  -- Rescue orphaned paid bookings (no dispatch entry at all, older than 2 min)
  -- — excludes targeted bookings, which always get their single dispatch row
  -- at creation time; if that ever failed, defaulting to broad search would
  -- silently override the patient's explicit choice of provider.
  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
    FROM bookings b
    WHERE b.status    = 'paid'
      AND b.targeted_provider_id IS NULL
      AND b.updated_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id)
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession)
    LIMIT 1;

    IF next_prov IS NOT NULL THEN
      INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
      VALUES (rec.id, next_prov, now(), now() + INTERVAL '2 minutes');
      UPDATE bookings SET dispatch_attempts = 1 WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN expired_count;
END;
$$;

-- ── 5. PATIENT-TRIGGERED RECOVERY AFTER A DECLINE ─────────────
-- Both reuse the SAME booking row (already paid) — never a new charge.

CREATE OR REPLACE FUNCTION retarget_booking(p_booking_id uuid, p_new_provider_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT * INTO b FROM bookings
  WHERE id = p_booking_id AND patient_id = auth.uid() AND status = 'provider_declined';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not awaiting a new provider choice';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM providers
    WHERE id = p_new_provider_id AND verification_status = 'verified' AND profession = b.profession
  ) THEN
    RAISE EXCEPTION 'That provider is not available for this service';
  END IF;

  UPDATE bookings
  SET targeted_provider_id = p_new_provider_id, status = 'paid'
  WHERE id = p_booking_id;

  INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
  VALUES (p_booking_id, p_new_provider_id, now(), now() + INTERVAL '2 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION retry_dispatch_broad(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b       RECORD;
  nearest uuid;
BEGIN
  SELECT * INTO b FROM bookings
  WHERE id = p_booking_id AND patient_id = auth.uid() AND status = 'provider_declined';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not awaiting a new provider choice';
  END IF;

  SELECT provider_id INTO nearest
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, b.profession)
  LIMIT 1;

  IF nearest IS NULL THEN
    RAISE EXCEPTION 'No available provider nearby right now — please try again shortly';
  END IF;

  UPDATE bookings
  SET targeted_provider_id = NULL, status = 'paid'
  WHERE id = p_booking_id;

  INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
  VALUES (p_booking_id, nearest, now(), now() + INTERVAL '2 minutes');
END;
$$;
