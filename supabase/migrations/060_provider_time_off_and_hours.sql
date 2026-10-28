-- ============================================================
-- Migration 060: provider time off and weekly working hours
--
-- The provider calendar (design: "Bookings and time off") lets a provider
-- block whole days, and Go live sets hours per day of the week.
--
--   provider_time_off      whole days a provider is unavailable; the provider
--                          manages their own rows
--   providers.weekly_hours {"mon":["08:00","18:00"], "sat":["09:00","14:00"], ...};
--                          a missing day means not working. NULL falls back to
--                          working_hours_start / working_hours_end
--
-- Blocked days count as busy everywhere a booking can land:
--   provider_busy_slots    (patient calendar, migration 057) returns them as
--                          whole day busy ranges
--   booking_has_conflict   (dispatch, migration 038) treats them as a conflict,
--                          so scheduled visits aren't offered on a day off
-- Both keep their signatures; existing callers are unchanged.
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day         date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_time_off_unique_day UNIQUE (provider_id, day)
);

ALTER TABLE provider_time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_time_off_own ON provider_time_off;
CREATE POLICY provider_time_off_own ON provider_time_off
  FOR ALL TO authenticated
  USING (
    provider_id IN (SELECT id FROM providers WHERE user_id = (SELECT auth.uid()))
    OR (SELECT public.get_user_role()) = 'admin'
  )
  WITH CHECK (
    provider_id IN (SELECT id FROM providers WHERE user_id = (SELECT auth.uid()))
    OR (SELECT public.get_user_role()) = 'admin'
  );

CREATE INDEX IF NOT EXISTS provider_time_off_provider_day_idx ON provider_time_off (provider_id, day);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS weekly_hours jsonb;

-- Days are whole Lagos calendar days
CREATE OR REPLACE FUNCTION public.provider_busy_slots(
  p_provider_id uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.starts_at, s.ends_at
  FROM (
    SELECT b.scheduled_at AS starts_at,
           b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 45)) AS ends_at
    FROM bookings b
    WHERE b.provider_id = p_provider_id
      AND b.status IN ('accepted', 'en_route', 'arrived', 'in_progress')
      AND b.scheduled_at IS NOT NULL
      AND b.scheduled_at >= p_from
      AND b.scheduled_at <  p_to
    UNION ALL
    SELECT (t.day::timestamp AT TIME ZONE 'Africa/Lagos'),
           ((t.day + 1)::timestamp AT TIME ZONE 'Africa/Lagos')
    FROM provider_time_off t
    WHERE t.provider_id = p_provider_id
      AND (t.day + 1)::timestamp AT TIME ZONE 'Africa/Lagos' > p_from
      AND t.day::timestamp AT TIME ZONE 'Africa/Lagos' < p_to
  ) s
  WHERE p_to > p_from
    AND p_to - p_from <= interval '62 days'
  ORDER BY s.starts_at;
$$;

REVOKE ALL ON FUNCTION public.provider_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_busy_slots(uuid, timestamptz, timestamptz) TO authenticated;

-- Day off check that sees every provider's rows whoever calls it (dispatch runs
-- in the patient's context, and provider_time_off RLS only shows a provider
-- their own days). Returns only true or false.
CREATE OR REPLACE FUNCTION public.provider_is_off(p_provider_id uuid, p_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM provider_time_off t
    WHERE t.provider_id = p_provider_id
      AND t.day = (p_at AT TIME ZONE 'Africa/Lagos')::date
  );
$$;

REVOKE ALL ON FUNCTION public.provider_is_off(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_is_off(uuid, timestamptz) TO authenticated, service_role;

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
  )
  OR public.provider_is_off(p_provider_id, p_scheduled_at); -- a blocked day off (migration 060)
$$;
