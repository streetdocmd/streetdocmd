-- ============================================================
-- Migration 023: Provider-agnostic platform (Pass 1)
--
-- Evolves the provider architecture from doctor-centric to
-- profession-aware, supporting Doctor, Nurse and Physiotherapist as
-- independently bookable, first-class providers. Everything here is
-- additive: no column is dropped or renamed, no row is deleted.
--
--   1. providers.profession — a normalized enum derived from the existing
--      free-text `specialty` column (which stays exactly as-is; it's what
--      registration/admin already display). This is the column dispatch,
--      permissions and encounter routing now key off.
--   2. providers.languages — additive, for the public provider profile.
--   3. provider_services — lets a provider list multiple bookable services
--      with their own price/duration, instead of the old single global
--      SERVICE_PRICES map. Existing booking flow is untouched; this is
--      purely additive infrastructure the UI now reads from.
--   4. nursing_encounters / physiotherapy_encounters — new encounter
--      tables, structurally distinct from clinical_notes (per product
--      spec: do not reuse the doctor's 14-step shape for other
--      professions). Same RLS pattern as clinical_notes.
--   5. visit_summaries becomes polymorphic — clinical_note_id is now
--      nullable, with two new nullable sibling FKs, so the patient
--      timeline can show nurse/physio visits too. A check constraint
--      guarantees exactly one source is ever set.
--   6. bookings.profession — normalized column derived from the existing
--      service_type, used by dispatch matching. service_type's CHECK is
--      extended (additively) with two physiotherapy service types.
--   7. get_nearby_providers() gains an optional profession filter and the
--      dispatch triggers now pass the booking's profession through, so a
--      booking is only ever offered to a matching provider. Passing NULL
--      preserves the old unfiltered behaviour for any other caller.
--   8. get_provider_profession() helper + tightened RLS on clinical_notes,
--      prescriptions and lab_orders so a nurse/physiotherapist provider
--      cannot write to doctor-only clinical tables even if they call
--      Supabase directly (defense in depth — the provider-web API routes
--      enforce this too, but those use the service-role client which
--      bypasses RLS entirely, so the mobile app's direct client calls
--      still need this).
-- ============================================================

-- ── 1. PROVIDER PROFESSION ────────────────────────────────────

alter table providers add column if not exists profession text;

update providers set profession = case
  when specialty in ('Medical Doctor (General)', 'Medical Doctor (Specialist)') then 'doctor'
  when specialty = 'Registered Nurse' then 'nurse'
  when specialty = 'Physiotherapist' then 'physiotherapist'
  when specialty = 'Medical Laboratory Scientist' then 'lab_scientist'
  else 'doctor' -- safe default: preserves existing doctor-flow behaviour for any unmapped legacy row
end
where profession is null;

alter table providers alter column profession set default 'doctor';

do $$ begin
  alter table providers add constraint providers_profession_check
    check (profession in ('doctor', 'nurse', 'physiotherapist', 'lab_scientist'));
exception when duplicate_object then null;
end $$;

alter table providers alter column profession set not null;

create index if not exists providers_profession_idx on providers(profession);

-- get_provider_profession() is defined here (rather than down in section 9
-- where it's used for the doctor-only-table tightening) because the RLS
-- policies in sections 4 and 5 below reference it too — a CREATE POLICY's
-- USING expression is validated at creation time, so the function must
-- already exist before anything that calls it is created.
CREATE OR REPLACE FUNCTION get_provider_profession()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT profession FROM providers WHERE user_id = auth.uid();
$$;

-- ── 2. LANGUAGES (public profile) ─────────────────────────────

alter table providers add column if not exists languages text[] not null default '{}';

-- ── 3. PROVIDER SERVICES ──────────────────────────────────────

create table if not exists provider_services (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references providers(id) on delete cascade,
  profession        text not null check (profession in ('doctor', 'nurse', 'physiotherapist', 'lab_scientist')),
  name              text not null,
  description       text,
  price             numeric(12,2) not null,
  duration_minutes  int,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists provider_services_provider_idx on provider_services(provider_id);
create index if not exists provider_services_active_idx on provider_services(active) where active = true;

alter table provider_services enable row level security;

do $$ begin
  create policy provider_services_public_read on provider_services
    for select using (
      active = true
      or provider_id in (select id from providers where user_id = auth.uid())
      or get_user_role() = 'admin'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy provider_services_owner_write on provider_services
    for all using (
      provider_id in (select id from providers where user_id = auth.uid())
      or get_user_role() = 'admin'
    );
exception when duplicate_object then null; end $$;

-- ── 4. NURSING ENCOUNTERS ─────────────────────────────────────

create table if not exists nursing_encounters (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references bookings(id) on delete cascade,
  patient_id            uuid not null references users(id),
  provider_id           uuid not null references providers(id),
  status                text not null default 'draft' check (status in ('draft', 'submitted')),
  visit_reason          text,
  patient_assessment    jsonb,
  vitals                jsonb,
  nursing_assessment    jsonb,
  intervention          jsonb,
  patient_education     jsonb,
  outcome               jsonb,
  escalation            jsonb,
  care_tasks            jsonb,
  follow_up_date        date,
  follow_up_notes       text,
  safeguarding_flag     boolean not null default false,
  submitted_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists nursing_encounters_booking_id_idx on nursing_encounters(booking_id);

alter table nursing_encounters enable row level security;

do $$ begin
  create policy providers_own_nursing_encounters on nursing_encounters
    for all using (
      (provider_id in (select id from providers where user_id = auth.uid()) and get_provider_profession() = 'nurse')
      or get_user_role() = 'admin'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy patients_read_own_nursing_encounters on nursing_encounters
    for select using (patient_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── 5. PHYSIOTHERAPY ENCOUNTERS ───────────────────────────────

create table if not exists physiotherapy_encounters (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references bookings(id) on delete cascade,
  patient_id              uuid not null references users(id),
  provider_id             uuid not null references providers(id),
  status                  text not null default 'draft' check (status in ('draft', 'submitted')),
  referral_reason         text,
  subjective_assessment   jsonb,
  pain_symptoms           jsonb,
  objective_assessment    jsonb,
  functional_measurements jsonb,
  professional_assessment jsonb,
  intervention            jsonb,
  patient_response        jsonb,
  progress                jsonb,
  home_program            jsonb,
  next_session_plan       text,
  follow_up_date          date,
  submitted_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists physiotherapy_encounters_booking_id_idx on physiotherapy_encounters(booking_id);

alter table physiotherapy_encounters enable row level security;

do $$ begin
  create policy providers_own_physio_encounters on physiotherapy_encounters
    for all using (
      (provider_id in (select id from providers where user_id = auth.uid()) and get_provider_profession() = 'physiotherapist')
      or get_user_role() = 'admin'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy patients_read_own_physio_encounters on physiotherapy_encounters
    for select using (patient_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── 6. VISIT SUMMARIES: MADE POLYMORPHIC ──────────────────────

alter table visit_summaries alter column clinical_note_id drop not null;

alter table visit_summaries add column if not exists nursing_encounter_id uuid references nursing_encounters(id) on delete cascade;
alter table visit_summaries add column if not exists physiotherapy_encounter_id uuid references physiotherapy_encounters(id) on delete cascade;

do $$ begin
  alter table visit_summaries add constraint visit_summaries_one_source_check check (
    (case when clinical_note_id is not null then 1 else 0 end)
  + (case when nursing_encounter_id is not null then 1 else 0 end)
  + (case when physiotherapy_encounter_id is not null then 1 else 0 end) = 1
  );
exception when duplicate_object then null; end $$;

create unique index if not exists visit_summaries_nursing_encounter_id_idx
  on visit_summaries(nursing_encounter_id) where nursing_encounter_id is not null;
create unique index if not exists visit_summaries_physio_encounter_id_idx
  on visit_summaries(physiotherapy_encounter_id) where physiotherapy_encounter_id is not null;

-- ── 6b. SAFEGUARDING ALERTS: MADE POLYMORPHIC ─────────────────
-- Same treatment as visit_summaries — safeguarding concerns can be raised
-- from any profession's encounter, not just the doctor's clinical_notes.

alter table safeguarding_alerts alter column clinical_note_id drop not null;

alter table safeguarding_alerts add column if not exists nursing_encounter_id uuid references nursing_encounters(id) on delete cascade;
alter table safeguarding_alerts add column if not exists physiotherapy_encounter_id uuid references physiotherapy_encounters(id) on delete cascade;

do $$ begin
  alter table safeguarding_alerts add constraint safeguarding_alerts_one_source_check check (
    (case when clinical_note_id is not null then 1 else 0 end)
  + (case when nursing_encounter_id is not null then 1 else 0 end)
  + (case when physiotherapy_encounter_id is not null then 1 else 0 end) <= 1
  );
exception when duplicate_object then null; end $$;

-- ── 7. BOOKINGS: PROFESSION + PHYSIOTHERAPY SERVICE TYPES ─────

alter table bookings add column if not exists profession text;

update bookings set profession = case
  when service_type in ('wound_care', 'elderly_review', 'nursing_care') then 'nurse'
  else 'doctor' -- general_consultation, wellness_check, custom_request all predate multi-profession booking
end
where profession is null;

alter table bookings alter column profession set default 'doctor';

do $$ begin
  alter table bookings add constraint bookings_profession_check
    check (profession in ('doctor', 'nurse', 'physiotherapist', 'lab_scientist'));
exception when duplicate_object then null; end $$;

alter table bookings alter column profession set not null;

create index if not exists bookings_profession_idx on bookings(profession);

alter table bookings drop constraint if exists bookings_service_type_check;
alter table bookings add constraint bookings_service_type_check check (service_type in (
  'general_consultation', 'wellness_check', 'wound_care', 'elderly_review',
  'nursing_care', 'custom_request', 'physiotherapy_assessment', 'physiotherapy_session'
));

-- ── 8. PROFESSION-AWARE DISPATCH MATCHING ─────────────────────
-- Signature-compatible: p_profession defaults to NULL (= unfiltered,
-- the old behaviour) so any existing caller that doesn't pass it keeps
-- working exactly as before.

CREATE OR REPLACE FUNCTION get_nearby_providers(
  booking_lat  double precision,
  booking_lng  double precision,
  radius_km    int DEFAULT 15,
  p_profession text DEFAULT NULL
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
  ORDER BY distance_km ASC;
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
  SELECT * INTO b FROM bookings WHERE id = NEW.booking_id AND status = 'pending';
  IF NOT FOUND THEN RETURN NEW; END IF;

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
    WHERE id = NEW.booking_id AND status = 'pending';
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
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
    FROM bookings b
    WHERE b.status = 'pending'
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
      WHERE id = rec.id AND status = 'pending';
    END IF;
  END LOOP;

  FOR rec IN
    SELECT b.id, b.patient_lat, b.patient_lng, b.profession
    FROM bookings b
    WHERE b.status    = 'pending'
      AND b.created_at < now() - INTERVAL '2 minutes'
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

-- ── 9. PROFESSION-SCOPED PERMISSIONS (defense in depth) ───────
-- get_provider_profession() was already defined earlier (see section 1) so
-- the nursing/physio encounter policies above could reference it too.

drop policy if exists providers_own_notes on clinical_notes;
create policy providers_own_notes on clinical_notes
  for all using (
    (provider_id in (select id from providers where user_id = auth.uid()) and get_provider_profession() = 'doctor')
    or get_user_role() = 'admin'
  );

drop policy if exists prescriptions_access on prescriptions;

create policy prescriptions_patient_read on prescriptions
  for select using (patient_id = auth.uid());

create policy prescriptions_provider_write on prescriptions
  for all using (
    (provider_id in (select id from providers where user_id = auth.uid()) and get_provider_profession() = 'doctor')
    or get_user_role() = 'admin'
  );

-- Note: `lab_orders` (from 001_initial_schema.sql) is superseded by
-- `investigation_orders` (013_lab_investigation_system.sql), which is what
-- the app actually writes to — that's the one that needs tightening.
drop policy if exists "inv_orders_access" on investigation_orders;

create policy inv_orders_read on investigation_orders
  for select using (
    patient_id = auth.uid()
    or provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() in ('admin', 'lab_staff')
  );

create policy inv_orders_provider_write on investigation_orders
  for all using (
    (provider_id in (select id from providers where user_id = auth.uid()) and get_provider_profession() = 'doctor')
    or get_user_role() in ('admin', 'lab_staff')
  );
