-- ============================================================
-- Migration 028: Care Episodes, Care Team, Care Plan, Care Tasks (Pass 2)
--
-- Additive layer on top of the existing booking/encounter system. A
-- booking (and everything that hangs off it — clinical_notes,
-- nursing_encounters, physiotherapy_encounters, prescriptions,
-- investigation_orders, hospital_referrals) can optionally be linked to
-- a care_episode via a nullable FK. Nothing about the standalone booking
-- flow changes: care_episode_id defaults to NULL, so a booking with no
-- episode behaves exactly as it does today.
--
-- Rather than duplicating medication/lab/pharmacy data into care-episode
-- tables, "what happened in this episode" is answered by querying the
-- existing tables filtered by care_episode_id (directly, or via
-- bookings.care_episode_id for tables that key off booking_id) — per the
-- product brief's explicit instruction not to duplicate that
-- functionality.
--
-- New tables get their own clean RLS. Existing tables' RLS is NOT
-- expanded to grant care-team-wide read access (e.g. a nurse reading a
-- doctor's clinical_notes within a shared episode) — Pass 1 already
-- found a live RLS bug from exactly this kind of policy layering
-- (permissive policies OR together, easy to accidentally widen access).
-- Instead, provider-web's care-episode views verify care-team membership
-- via care_team_members RLS first (using the caller's own session), then
-- use the service-role client to read the referenced clinical data —
-- the same pattern already used elsewhere in this codebase for
-- cross-referencing data that doesn't directly belong to the querying
-- provider (e.g. the active-booking page, admin pages).
-- ============================================================

-- ── 1. CARE EPISODES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_episodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES users(id),
  title        text NOT NULL,
  reason       text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN (
                 'active', 'monitoring', 'follow_up_due', 'overdue',
                 'referred', 'resolved', 'closed', 'escalated'
               )),
  start_date   date NOT NULL DEFAULT CURRENT_DATE,
  end_date     date,
  lead_provider_id uuid REFERENCES providers(id),
  created_by   uuid NOT NULL REFERENCES providers(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_episodes_patient_idx ON care_episodes(patient_id);
CREATE INDEX IF NOT EXISTS care_episodes_status_idx ON care_episodes(status);

ALTER TABLE care_episodes ENABLE ROW LEVEL SECURITY;

-- ── 2. CARE TEAM ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  provider_id     uuid NOT NULL REFERENCES providers(id),
  is_lead         boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  left_at         timestamptz
);

-- A provider can rejoin after leaving, but only one ACTIVE membership
-- per (episode, provider) at a time.
CREATE UNIQUE INDEX IF NOT EXISTS care_team_members_active_unique_idx
  ON care_team_members(care_episode_id, provider_id) WHERE active = true;

ALTER TABLE care_team_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling provider an active member of this episode's
-- care team? SECURITY DEFINER so it can read care_team_members/providers
-- irrespective of the caller's own RLS, same pattern as
-- get_provider_profession() in migration 023.
CREATE OR REPLACE FUNCTION is_care_team_member(p_episode_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM care_team_members ctm
    WHERE ctm.care_episode_id = p_episode_id
      AND ctm.active = true
      AND ctm.provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  );
$$;

-- Now that the helper exists, define care_episodes' policies (deferred
-- from section 1 for the same forward-reference reason documented in
-- migration 023 — a policy's expression must resolve at creation time).
DO $$ BEGIN
  CREATE POLICY care_episodes_select ON care_episodes
    FOR SELECT USING (
      patient_id = auth.uid()
      OR is_care_team_member(id)
      OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_episodes_provider_insert ON care_episodes
    FOR INSERT WITH CHECK (
      created_by IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_episodes_team_update ON care_episodes
    FOR UPDATE USING (
      is_care_team_member(id) OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_team_members_select ON care_team_members
    FOR SELECT USING (
      is_care_team_member(care_episode_id)
      OR get_user_role() = 'admin'
      OR care_episode_id IN (SELECT id FROM care_episodes WHERE patient_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_team_members_team_write ON care_team_members
    FOR INSERT WITH CHECK (
      is_care_team_member(care_episode_id)
      OR care_episode_id IN (SELECT id FROM care_episodes WHERE created_by IN (SELECT id FROM providers WHERE user_id = auth.uid()))
      OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_team_members_self_update ON care_team_members
    FOR UPDATE USING (
      provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR is_care_team_member(care_episode_id)
      OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. CARE PLAN ───────────────────────────────────────────────
-- One evolving plan per episode — "updateable after subsequent
-- encounters" reads as a single living document, not a new document per
-- edit. Medications/investigations/referrals are deliberately NOT
-- columns here; they're queried live from the existing tables via
-- bookings.care_episode_id (see section 5) per the brief's instruction
-- not to duplicate that data.

CREATE TABLE IF NOT EXISTS care_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id uuid NOT NULL UNIQUE REFERENCES care_episodes(id) ON DELETE CASCADE,
  goals           jsonb,          -- [{ goal: text, status: 'active'|'achieved'|'dropped' }]
  instructions    text,
  notes           text,
  follow_up_plan  text,
  follow_up_date  date,
  created_by      uuid NOT NULL REFERENCES providers(id),
  updated_by      uuid REFERENCES providers(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY care_plans_select ON care_plans
    FOR SELECT USING (
      is_care_team_member(care_episode_id)
      OR get_user_role() = 'admin'
      OR care_episode_id IN (SELECT id FROM care_episodes WHERE patient_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_plans_team_write ON care_plans
    FOR ALL USING (
      is_care_team_member(care_episode_id) OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. CARE TASKS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_episode_id   uuid NOT NULL REFERENCES care_episodes(id) ON DELETE CASCADE,
  description       text NOT NULL,
  task_type         text NOT NULL DEFAULT 'other' CHECK (task_type IN (
                       'medication', 'lab', 'monitoring', 'physiotherapy',
                       'wound_care', 'follow_up', 'other'
                     )),
  due_date          date,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN (
                       'pending', 'in_progress', 'completed', 'cancelled'
                     )),
  completed_at      timestamptz,
  created_by        uuid NOT NULL REFERENCES providers(id),
  assigned_to       uuid REFERENCES providers(id),
  related_booking_id uuid REFERENCES bookings(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_tasks_episode_idx ON care_tasks(care_episode_id);
CREATE INDEX IF NOT EXISTS care_tasks_due_date_idx ON care_tasks(due_date) WHERE status IN ('pending', 'in_progress');

ALTER TABLE care_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY care_tasks_select ON care_tasks
    FOR SELECT USING (
      is_care_team_member(care_episode_id)
      OR get_user_role() = 'admin'
      OR care_episode_id IN (SELECT id FROM care_episodes WHERE patient_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY care_tasks_team_write ON care_tasks
    FOR ALL USING (
      is_care_team_member(care_episode_id) OR get_user_role() = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. LINK EXISTING OBJECTS TO A CARE EPISODE ────────────────
-- Nullable throughout — NULL means "standalone, no episode," which is
-- and remains the default for every existing row and every new booking
-- that doesn't explicitly opt in.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS care_episode_id uuid REFERENCES care_episodes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_care_episode_idx ON bookings(care_episode_id) WHERE care_episode_id IS NOT NULL;

-- investigation_orders.booking_id is already nullable (patient-initiated
-- requests, migration 024) — this lets a patient-initiated lab request
-- still belong to an episode even with no booking to inherit it from.
ALTER TABLE investigation_orders ADD COLUMN IF NOT EXISTS care_episode_id uuid REFERENCES care_episodes(id) ON DELETE SET NULL;

-- prescription_orders (pharmacy delivery activity) only reaches a
-- booking via the legacy visits table (visit_id -> visits.booking_id) —
-- linking directly avoids depending on that chain for the timeline.
ALTER TABLE prescription_orders ADD COLUMN IF NOT EXISTS care_episode_id uuid REFERENCES care_episodes(id) ON DELETE SET NULL;

-- ── 6. STATUS ENGINE (not cosmetic) ───────────────────────────
-- Runs daily. Only moves an episode between the "auto-managed" states
-- (active / monitoring / follow_up_due / overdue) based on real
-- open-task due dates — it never touches an episode a provider has
-- explicitly set to referred / resolved / closed / escalated, since
-- those are clinical judgment calls this pass has no business
-- overriding.

CREATE OR REPLACE FUNCTION refresh_care_episode_statuses()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count int;
BEGIN
  WITH computed AS (
    SELECT
      ce.id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM care_tasks t
          WHERE t.care_episode_id = ce.id AND t.status IN ('pending', 'in_progress')
            AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE
        ) THEN 'overdue'
        WHEN EXISTS (
          SELECT 1 FROM care_tasks t
          WHERE t.care_episode_id = ce.id AND t.status IN ('pending', 'in_progress')
            AND t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE + INTERVAL '3 days'
        ) THEN 'follow_up_due'
        WHEN EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.care_episode_id = ce.id AND b.status = 'completed'
            AND b.completed_at > now() - INTERVAL '30 days'
        ) THEN 'monitoring'
        ELSE 'active'
      END AS new_status
    FROM care_episodes ce
    WHERE ce.status IN ('active', 'monitoring', 'follow_up_due', 'overdue')
  )
  UPDATE care_episodes ce
  SET status = computed.new_status, updated_at = now()
  FROM computed
  WHERE ce.id = computed.id AND ce.status IS DISTINCT FROM computed.new_status;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN PERFORM cron.unschedule('refresh-care-episode-statuses'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'refresh-care-episode-statuses',
  '0 3 * * *', -- daily at 03:00
  'SELECT refresh_care_episode_statuses()'
);
