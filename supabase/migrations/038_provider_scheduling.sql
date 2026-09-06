-- ============================================================
-- Migration 038: Scheduled bookings + provider calendar conflict prevention
--
-- Introduces an appointment-time concept the platform has never had:
-- `bookings.scheduled_at` already existed in the schema (unused by any
-- application code until now) and is reused as the single source of
-- truth for "when" — NULL means ASAP (today's only behaviour, completely
-- unchanged), a timestamp means the patient picked a specific slot.
--
-- Everything here is additive and gated on scheduled_at being set:
-- every booking created by every existing flow has scheduled_at = NULL,
-- so every new branch below is a no-op for all current/historical data.
--
-- get_nearby_providers() currently has 5 params, ending in
-- p_preferred_provider_id (continuity-of-care ORDERING, from
-- 030_follow_ups.sql — NOT a filter, ranks a match first). This adds two
-- MORE trailing params after it (p_scheduled_at, p_duration_minutes) so
-- every existing positional and named call — dispatch triggers,
-- migration 037's retarget/retry RPCs — keeps working unchanged; nothing
-- here reorders or removes the existing 5.
--
-- The "calendar" is just bookings rows with scheduled_at set, rendered
-- per-provider on provider-web/admin — no new table needed. Conflict
-- prevention is enforced server-side in three places so it can't be
-- bypassed: candidate selection (get_nearby_providers), acceptance
-- (accept_dispatch, defense against a race), and retargeting
-- (retarget_booking/retry_dispatch_broad from migration 037).
-- ============================================================

-- ── 1. DURATION ────────────────────────────────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes int NOT NULL DEFAULT 45;

-- ── 2. CONFLICT CHECK ──────────────────────────────────────────
-- An existing booking "occupies" [scheduled_at, +duration] if scheduled,
-- or [accepted_at, +duration] once an ASAP visit is actually underway —
-- only confirmed/active bookings count; pending/declined/finished ones
-- never block a slot.

CREATE OR REPLACE FUNCTION booking_has_conflict(
  p_provider_id      uuid,
  p_scheduled_at     timestamptz,
  p_duration_minutes int,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.provider_id = p_provider_id
      AND b.status IN ('accepted', 'en_route', 'arrived', 'in_progress')
      AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
      AND COALESCE(b.scheduled_at, b.accepted_at, now())
            < p_scheduled_at + (p_duration_minutes || ' minutes')::interval
      AND COALESCE(b.scheduled_at, b.accepted_at, now())
            + (COALESCE(b.duration_minutes, 45) || ' minutes')::interval
            > p_scheduled_at
  );
$$;

-- ── 3. DISPATCH MATCHING: SCHEDULED-AWARE ─────────────────────
-- Signature-compatible: the two new trailing params default to
-- NULL/45, preserving today's exact query and ordering for any caller
-- that doesn't pass them.

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat             double precision,
  booking_lng             double precision,
  radius_km               int DEFAULT 15,
  p_profession            text DEFAULT NULL,
  p_preferred_provider_id uuid DEFAULT NULL,
  p_scheduled_at          timestamptz DEFAULT NULL,
  p_duration_minutes      int DEFAULT 45
)
RETURNS TABLE (
  provider_id uuid,
  distance_km double precision,
  eta_minutes int
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    haversine_km(booking_lat, booking_lng, p.lat, p.lng)        AS distance_km,
    CEIL((haversine_km(booking_lat, booking_lng, p.lat, p.lng)
          / 20.0) * 60)::int                                    AS eta_minutes
  FROM providers p
  WHERE
    -- "available" is an online-right-now toggle — irrelevant to a future
    -- scheduled slot, only meaningful for an ASAP request.
    (p_scheduled_at IS NOT NULL OR p.available = true)
    AND p.verification_status = 'verified'
    AND p.badge_issued        = true
    AND p.lat                IS NOT NULL
    AND p.lng                IS NOT NULL
    AND (p_profession IS NULL OR p.profession = p_profession)
    AND (p_scheduled_at IS NULL OR NOT booking_has_conflict(p.id, p_scheduled_at, p_duration_minutes))
    AND haversine_km(booking_lat, booking_lng, p.lat, p.lng) <= radius_km
  ORDER BY
    (p_preferred_provider_id IS NOT NULL AND p.id = p_preferred_provider_id) DESC,
    distance_km ASC;
END;
$$;

-- ── 4. DISPATCH TRIGGERS: PASS SCHEDULING THROUGH ─────────────

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
  prov    RECORD;
BEGIN
  IF NEW.provider_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.targeted_provider_id IS NOT NULL THEN
    -- A scheduled request for a specific provider who's already booked
    -- then can never be satisfied by trying someone else (the patient
    -- explicitly chose this provider) — same terminal state as a decline.
    IF NEW.scheduled_at IS NOT NULL
       AND booking_has_conflict(NEW.targeted_provider_id, NEW.scheduled_at, NEW.duration_minutes) THEN
      UPDATE bookings SET status = 'provider_declined' WHERE id = NEW.id AND status = 'paid';
      INSERT INTO notifications_queue (patient_id, channel, message, send_at, type)
      VALUES (
        NEW.patient_id, 'sms',
        'Your preferred provider already has a booking at that time. Open the app to choose another provider or time.',
        now(), 'preferred_provider_declined'
      );
      RETURN NEW;
    END IF;

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

  -- Continuity preference (preferred_provider_id) only applies on this
  -- first dispatch attempt, same as before 038 — retries never carry it.
  SELECT provider_id INTO nearest
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15, NEW.profession, NEW.preferred_provider_id, NEW.scheduled_at, NEW.duration_minutes)
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

  -- No continuity preference on a retry (same rule 030 established) —
  -- pass NULL for p_preferred_provider_id explicitly.
  SELECT provider_id INTO next_prov
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, b.profession, NULL, b.scheduled_at, b.duration_minutes)
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

  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession, b.scheduled_at, b.duration_minutes
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
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession, NULL, rec.scheduled_at, rec.duration_minutes)
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

  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession, b.scheduled_at, b.duration_minutes
    FROM bookings b
    WHERE b.status    = 'paid'
      AND b.targeted_provider_id IS NULL
      AND b.updated_at < now() - INTERVAL '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM dispatch_queue dq WHERE dq.booking_id = b.id)
  LOOP
    SELECT provider_id INTO next_prov
    FROM get_nearby_providers(rec.patient_lat, rec.patient_lng, 15, rec.profession, NULL, rec.scheduled_at, rec.duration_minutes)
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

-- ── 5. ACCEPT: FINAL CONFLICT GUARD ────────────────────────────
-- Defense against a race between two offers landing on the same
-- provider for overlapping scheduled slots before either is accepted.

CREATE OR REPLACE FUNCTION accept_dispatch(p_dispatch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d RECORD;
  b RECORD;
BEGIN
  SELECT dq.* INTO d
  FROM dispatch_queue dq
  WHERE dq.id           = p_dispatch_id
    AND dq.response    IS NULL
    AND dq.expires_at   > now()
    AND dq.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found, already responded, or expired';
  END IF;

  SELECT * INTO b FROM bookings WHERE id = d.booking_id AND status = 'paid';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking is no longer available';
  END IF;

  IF b.scheduled_at IS NOT NULL
     AND booking_has_conflict(d.provider_id, b.scheduled_at, b.duration_minutes, b.id) THEN
    RAISE EXCEPTION 'You already have a booking at that time';
  END IF;

  UPDATE dispatch_queue
  SET response = 'accepted', responded_at = now()
  WHERE id = p_dispatch_id;

  UPDATE bookings
  SET status      = 'accepted',
      accepted_at = now(),
      provider_id = d.provider_id
  WHERE id = d.booking_id AND status = 'paid';
END;
$$;

-- ── 6. RETARGET / RETRY (migration 037): PASS SCHEDULING THROUGH ──

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

  IF b.scheduled_at IS NOT NULL
     AND booking_has_conflict(p_new_provider_id, b.scheduled_at, b.duration_minutes) THEN
    RAISE EXCEPTION 'That provider already has a booking at this time';
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
  FROM get_nearby_providers(b.patient_lat, b.patient_lng, 15, b.profession, NULL, b.scheduled_at, b.duration_minutes)
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
