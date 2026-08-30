-- ============================================================
-- Migration 030: Follow-ups + continuity dispatch + platform settings (Pass 3 Tier 1)
--
-- A "follow-up" is a distinct record from a booking: it's created the
-- moment a provider sets a follow-up date while completing an encounter,
-- and represents intent ("this patient should be seen again, here's why
-- and by whom") independent of whether/when the patient actually books
-- it. A booking only gets created once the patient acts on it, same as
-- any other booking — this migration does not introduce a second
-- booking/payment system, per the brief.
--
-- Continuity ("continue your care with Dr. X") is implemented as a
-- dispatch-ordering preference, not a provider-pinning mechanism: a
-- preferred_provider_id on the booking, consulted only to reorder
-- get_nearby_providers()'s candidate list when present. The existing
-- auto-dispatch trigger, payment gating, and accept flow are otherwise
-- completely unchanged — deliberately staying clear of the
-- provider-pinning bug already being worked on elsewhere (see project
-- memory: payment/dispatch ownership).
-- ============================================================

-- ── 1. FOLLOW-UPS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follow_ups (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id             uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  patient_id                  uuid NOT NULL REFERENCES users(id),
  -- Which encounter this follow-up was set from (polymorphic, same
  -- pattern as visit_summaries/safeguarding_alerts in migration 023) —
  -- nullable individually since only one applies per row, all three can
  -- be null if a follow-up is ever created outside an encounter.
  clinical_note_id            uuid REFERENCES clinical_notes(id),
  nursing_encounter_id        uuid REFERENCES nursing_encounters(id),
  physiotherapy_encounter_id  uuid REFERENCES physiotherapy_encounters(id),
  created_by                  uuid NOT NULL REFERENCES providers(id),
  reason                      text,
  follow_up_date              date NOT NULL,
  follow_up_type              text NOT NULL DEFAULT 'clinical_review' CHECK (follow_up_type IN (
                                 'home_visit', 'virtual_consultation', 'lab_review', 'clinical_review'
                               )),
  -- Who the patient should continue with — defaults to whoever set the
  -- follow-up (the common case), but is its own column so a provider
  -- could hand off to a specific colleague later without conflating
  -- "who requested this" with "who should see the patient next."
  continuing_provider_id      uuid REFERENCES providers(id),
  status                      text NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                                 'scheduled', 'booked', 'completed', 'missed', 'cancelled'
                               )),
  booking_id                  uuid REFERENCES bookings(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_ups_episode_idx ON follow_ups(care_episode_id);
CREATE INDEX IF NOT EXISTS follow_ups_patient_idx ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS follow_ups_status_date_idx ON follow_ups(status, follow_up_date);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY follow_ups_select ON follow_ups
    FOR SELECT USING (
      patient_id = auth.uid()
      OR is_care_team_member(care_episode_id)
      OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY follow_ups_team_write ON follow_ups
    FOR ALL USING (
      is_care_team_member(care_episode_id) OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A patient needs to be able to mark their own follow-up 'booked' (set
-- booking_id) once they act on it — provider-web's team-write policy
-- above doesn't cover the patient themselves.
DO $$ BEGIN
  CREATE POLICY follow_ups_patient_book ON follow_ups
    FOR UPDATE USING (patient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. BOOKINGS: FOLLOW-UP + CONTINUITY COLUMNS ───────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_follow_up boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS follow_up_id uuid REFERENCES follow_ups(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS preferred_provider_id uuid REFERENCES providers(id);

-- ── 3. PLATFORM SETTINGS (centrally configurable values) ──────
-- A single key/value table rather than a new column-per-setting
-- pattern, so a placeholder rate like the follow-up discount can change
-- without a migration. Admin-only — server routes read it with the
-- service-role client, never exposed to a public/anon query.

CREATE TABLE IF NOT EXISTS platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY platform_settings_admin_only ON platform_settings
    FOR ALL USING (get_user_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO platform_settings (key, value, description) VALUES
  ('follow_up_discount_rate', '0.10',
   'Follow-up visits are priced this fraction below the standard fee for the same service_type. Placeholder rate pending a full pricing review before beta.')
ON CONFLICT (key) DO NOTHING;

-- ── 4. CONTINUITY-AWARE DISPATCH ───────────────────────────────
-- Adds an optional preferred-provider priority to the existing
-- profession filter from migration 023. When set and that provider is
-- actually in the eligible (available/verified/in-range/right-profession)
-- pool, they're ranked first; otherwise ordering is unchanged (nearest
-- first). The dispatch trigger, payment gating, and accept flow are not
-- touched — this only changes which provider get_nearby_providers()
-- returns first.

-- CREATE OR REPLACE only replaces a function whose argument TYPE LIST is
-- identical — adding a 5th parameter changes the signature, so without
-- this explicit drop first, Postgres would silently create a second,
-- overloaded 4-argument version alongside this one instead of replacing
-- it (both would keep working via overload resolution, but leaving a
-- stale duplicate definition live is exactly the kind of thing that
-- causes surprises later — caught before running, not after).
DROP FUNCTION IF EXISTS get_nearby_providers(double precision, double precision, int, text);

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat            double precision,
  booking_lng            double precision,
  radius_km              int DEFAULT 15,
  p_profession            text DEFAULT NULL,
  p_preferred_provider_id uuid DEFAULT NULL
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
    p.available              = true
    AND p.verification_status = 'verified'
    AND p.badge_issued        = true
    AND p.lat                IS NOT NULL
    AND p.lng                IS NOT NULL
    AND (p_profession IS NULL OR p.profession = p_profession)
    AND haversine_km(booking_lat, booking_lng, p.lat, p.lng) <= radius_km
  ORDER BY
    (p_preferred_provider_id IS NOT NULL AND p.id = p_preferred_provider_id) DESC,
    distance_km ASC;
END;
$$;

CREATE OR REPLACE FUNCTION initial_booking_dispatch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nearest uuid;
BEGIN
  IF NEW.provider_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT provider_id INTO nearest
  FROM get_nearby_providers(NEW.patient_lat, NEW.patient_lng, 15, NEW.profession, NEW.preferred_provider_id)
  LIMIT 1;

  IF nearest IS NOT NULL THEN
    INSERT INTO dispatch_queue (booking_id, provider_id, sent_at, expires_at)
    VALUES (NEW.id, nearest, now(), now() + INTERVAL '2 minutes');
  END IF;

  RETURN NEW;
END;
$$;

-- on_dispatch_declined()/process_expired_dispatches() deliberately NOT
-- touched here: if a preferred provider declines or times out, falling
-- through to normal nearest-provider retry (no preference on the retry)
-- is the correct behaviour — the patient already lost their first
-- choice, forcing another preference pass would just delay care.
