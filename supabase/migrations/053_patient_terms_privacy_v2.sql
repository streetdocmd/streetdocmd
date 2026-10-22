-- ============================================================
-- Migration 053: Patient Terms of Service + Privacy Policy v2.0
--
-- The approved v2.0 documents require two SEPARATE, unchecked-by-default
-- controls at registration — "agree to the Patient Terms of Service" and
-- "acknowledge the Privacy Policy" — and require StreetdocMD to record the
-- document version, the accepting account, the action and the timestamp
-- (Terms cl. 20, Privacy Policy s.7). The privacy acknowledgement is NOT
-- consent to processing, so it is recorded separately from the 035
-- "core" consent rather than by reusing it.
--
--   1. users: latest accepted Terms / acknowledged Privacy Policy version
--      and when (the current state; consent_log keeps the full history).
--   2. consent_log: allow consent_type 'terms_of_service' / 'privacy_policy'
--      and action 'accepted' (Terms) / 'acknowledged' (Privacy Policy), so
--      the log never describes the acknowledgement as a consent 'grant'.
--   3. guard_users_legal_acceptance: client sessions can't write those
--      users columns directly, so the timestamps can't be back/forward
--      dated from a device. They are only written by
--   4. record_patient_legal_acceptance(): SECURITY DEFINER RPC that stamps
--      both documents with database time and appends the two consent_log
--      rows in one transaction. Callable by the signed-in patient for
--      themselves, or by the service role (patient-web /api/register) for a
--      named patient.
-- ============================================================

-- ── 1. users columns ─────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_version            text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version   text,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at  timestamptz;

-- ── 2. consent_log types ─────────────────────────────────────
-- 035 declared the CHECK inline, so Postgres named it
-- consent_log_consent_type_check.
ALTER TABLE public.consent_log DROP CONSTRAINT IF EXISTS consent_log_consent_type_check;
ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_consent_type_check CHECK (consent_type IN (
    'core', 'care_team', 'facility', 'location',
    'marketing', 'uploads', 'family_member',
    'terms_of_service', 'privacy_policy'
  )) NOT VALID;

ALTER TABLE public.consent_log DROP CONSTRAINT IF EXISTS consent_log_action_check;
ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_action_check CHECK (action IN (
    'granted', 'withdrawn', 'updated', 'accepted', 'acknowledged'
  )) NOT VALID;

CREATE INDEX IF NOT EXISTS consent_log_patient_type_idx
  ON public.consent_log (patient_id, consent_type, created_at DESC);

-- ── 3. Guard: legal columns only change through the RPC ──────
-- Same convention as 048's role guard: only direct writes from client
-- sessions are restricted. Inside the SECURITY DEFINER RPC current_user is
-- the function owner; server routes run as service_role.
CREATE OR REPLACE FUNCTION public.guard_users_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.terms_version           := NULL;
    NEW.terms_accepted_at       := NULL;
    NEW.privacy_policy_version  := NULL;
    NEW.privacy_acknowledged_at := NULL;
  ELSE
    NEW.terms_version           := OLD.terms_version;
    NEW.terms_accepted_at       := OLD.terms_accepted_at;
    NEW.privacy_policy_version  := OLD.privacy_policy_version;
    NEW.privacy_acknowledged_at := OLD.privacy_acknowledged_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_legal_acceptance ON public.users;
CREATE TRIGGER users_guard_legal_acceptance
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_legal_acceptance();

-- ── 4. Record acceptance ─────────────────────────────────────
-- p_context:
--   'signup'          — ticked on the registration form and recorded in the
--                       same request (patient-web): accepted now().
--   'signup_deferred' — ticked on the mobile registration form, but the
--                       profile row is only created on the first signed-in
--                       launch (possibly after email confirmation). The
--                       acceptance happened when the sign-up was submitted,
--                       so use auth.users.created_at — server time of that
--                       request — not the phone's clock.
--   'complete_profile'— ticked on the mobile "finish setting up" screen.
--   'reaccept'        — an existing patient accepting a new version.
CREATE OR REPLACE FUNCTION public.record_patient_legal_acceptance(
  p_terms_version   text,
  p_privacy_version text,
  p_context         text DEFAULT 'reaccept',
  p_patient_id      uuid DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_claims  jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_service boolean := coalesce(v_claims ->> 'role', '') = 'service_role';
  v_uid     uuid := auth.uid();
  v_target  uuid;
  v_at      timestamptz := now();
BEGIN
  IF v_service THEN
    v_target := p_patient_id;
  ELSE
    IF p_patient_id IS NOT NULL AND p_patient_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'You can only record acceptance for your own account'
        USING ERRCODE = '42501';
    END IF;
    v_target := v_uid;
  END IF;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_terms_version), '') = '' OR length(p_terms_version) > 20
     OR coalesce(btrim(p_privacy_version), '') = '' OR length(p_privacy_version) > 20 THEN
    RAISE EXCEPTION 'A document version is required' USING ERRCODE = '22023';
  END IF;

  IF p_context NOT IN ('signup', 'signup_deferred', 'complete_profile', 'reaccept') THEN
    RAISE EXCEPTION 'Unknown acceptance context %', p_context USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_target AND role = 'patient') THEN
    RAISE EXCEPTION 'Patient profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Only back-date to the sign-up request while the profile row is brand
  -- new (created on this first signed-in launch) and nothing has been
  -- recorded yet; otherwise this is an ordinary acceptance, stamped now().
  IF p_context = 'signup_deferred' THEN
    SELECT least(coalesce(au.created_at, now()), now()) INTO v_at
    FROM auth.users au
    JOIN public.users u ON u.id = au.id
    WHERE au.id = v_target
      AND u.terms_accepted_at IS NULL
      AND u.privacy_acknowledged_at IS NULL
      AND u.created_at > now() - interval '15 minutes';
    v_at := coalesce(v_at, now());
  END IF;

  UPDATE public.users
  SET terms_version           = p_terms_version,
      terms_accepted_at       = v_at,
      privacy_policy_version  = p_privacy_version,
      privacy_acknowledged_at = v_at
  WHERE id = v_target;

  INSERT INTO public.consent_log (patient_id, consent_type, action, policy_version, context, created_at)
  VALUES
    (v_target, 'terms_of_service', 'accepted',     p_terms_version,   p_context, v_at),
    (v_target, 'privacy_policy',   'acknowledged', p_privacy_version, p_context, v_at);

  RETURN v_at;
END;
$$;

REVOKE ALL ON FUNCTION public.record_patient_legal_acceptance(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_patient_legal_acceptance(text, text, text, uuid) TO authenticated, service_role;
