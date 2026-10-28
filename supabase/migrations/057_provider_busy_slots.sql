-- ============================================================
-- Migration 057: provider_busy_slots, for the patient schedule calendar
--
-- The patient app shows a provider's month as open, partly booked or fully
-- booked days, and greys out taken times when booking. Patients can't read
-- other patients' bookings (RLS), so this SECURITY DEFINER function returns
-- only the busy time ranges: no patient, booking id, address or service.
--
-- "Busy" uses the same rule as booking_has_conflict (migration 038): a
-- confirmed or active booking with a scheduled time. Requests are limited to
-- a 62 day window so the function can't be used to scan a provider's history.
-- ============================================================

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
  SELECT b.scheduled_at,
         b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 45))
  FROM bookings b
  WHERE b.provider_id = p_provider_id
    AND b.status IN ('accepted', 'en_route', 'arrived', 'in_progress')
    AND b.scheduled_at IS NOT NULL
    AND b.scheduled_at >= p_from
    AND b.scheduled_at <  p_to
    AND p_to > p_from
    AND p_to - p_from <= interval '62 days'
  ORDER BY b.scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.provider_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_busy_slots(uuid, timestamptz, timestamptz) TO authenticated;
