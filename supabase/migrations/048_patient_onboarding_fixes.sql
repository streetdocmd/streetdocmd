-- ============================================================
-- Migration 048: Patient onboarding fixes
--
--   1. users.email was never populated for new sign-ups. The
--      on_auth_user_email_inserted trigger (016/016b) fires AFTER INSERT on
--      auth.users, i.e. before the app has created the public.users row,
--      so its UPDATE matches nothing. Fill it on public.users INSERT
--      instead, and backfill rows left NULL.
--
--   2. Role self-escalation. users_self_write / users_insert_own (001)
--      let any signed-in user write their own row with no column limits,
--      so a patient could set role = 'admin' with the public anon key.
--      Every legitimate non-patient role write goes through a server
--      route using the service-role key (admin, provider-web, facility
--      approval), so end-user sessions are now limited to:
--        - INSERT: role must be 'patient'
--        - UPDATE: role cannot change
--      Admin sessions, the service role and direct SQL are unaffected.
-- ============================================================

-- ── 1. users.email ───────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;  -- normally added by 016; guard in case it wasn't applied

CREATE OR REPLACE FUNCTION public.fill_user_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    SELECT au.email INTO NEW.email FROM auth.users au WHERE au.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_fill_email ON public.users;
CREATE TRIGGER users_fill_email
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fill_user_email_from_auth();

UPDATE public.users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id AND u.email IS NULL;

-- ── 2. Role guard ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_users_role()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only direct writes from client sessions are restricted (same convention
  -- as 049): current_user is 'service_role' for server routes and the
  -- function owner inside SECURITY DEFINER functions; pg_trigger_depth() > 1
  -- means another trigger is writing.
  IF current_user NOT IN ('authenticated', 'anon')
     OR pg_trigger_depth() > 1
     OR coalesce(public.get_user_role(), '') = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'Only patient accounts can be created from the app'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Account role cannot be changed from the app'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_role ON public.users;
CREATE TRIGGER users_guard_role
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_role();
