-- ============================================================
-- Migration 055: Supabase Security/Performance Advisor clean-up
--
--   1. "Auth RLS Initialization Plan" (performance). Policies that call
--      auth.uid() / auth.role() / auth.jwt() / auth.email() or our
--      get_user_role() directly are re-evaluated for EVERY row scanned.
--      Wrapping the call as (SELECT auth.uid()) lets Postgres evaluate it
--      once per statement (an "initplan"). This is Supabase's documented
--      fix and does not change what any policy allows: none of these
--      functions depend on the row being checked.
--      Rather than hand-editing ~100 policies across 32 migrations, every
--      policy in the public schema is rewritten from its current definition.
--      A policy that fails to rewrite keeps its original definition and is
--      reported with a NOTICE; the migration carries on.
--
--   2. "RLS Disabled in Public: spatial_ref_sys" (security). PostGIS's
--      table of map projections — public reference data, no user data — but
--      reachable through the API without RLS. Enable RLS with a read-only
--      policy so PostGIS functions (which read it as the calling user) keep
--      working. On hosted Supabase the table may be owned by a system role;
--      if we're not allowed to change it, this step is skipped with a NOTICE.
--
-- Idempotent: already-wrapped calls are left alone, so re-running is a no-op.
-- ============================================================

-- ── 1. WRAP AUTH CALLS IN RLS POLICIES ───────────────────────

DO $$
DECLARE
  r         record;
  new_qual  text;
  new_check text;
  stmt      text;
  changed   int := 0;
  failed    int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') || ' ' || coalesce(with_check, '')
      ) ~ '(auth\.(uid|role|jwt|email)\(\)|get_user_role\(\))'
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    -- (?<!SELECT ) skips calls that are already wrapped: Postgres prints a wrapped
    -- call back as "( SELECT auth.uid() AS uid)".
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)', '(SELECT auth.\1())', 'g');
      new_qual := regexp_replace(new_qual, '(?<!SELECT )(public\.)?get_user_role\(\)', '(SELECT public.get_user_role())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)', '(SELECT auth.\1())', 'g');
      new_check := regexp_replace(new_check, '(?<!SELECT )(public\.)?get_user_role\(\)', '(SELECT public.get_user_role())', 'g');
    END IF;

    IF new_qual IS NOT DISTINCT FROM r.qual AND new_check IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE; -- already optimised
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    BEGIN
      EXECUTE stmt;
      changed := changed + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE '055: left policy "%" on %.% unchanged (%)', r.policyname, r.schemaname, r.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '055: optimised % policies, % left unchanged', changed, failed;
END $$;

-- ── 2. spatial_ref_sys (PostGIS reference data) ──────────────

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys;
    CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys
      FOR SELECT USING (true);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '055: not permitted to change public.spatial_ref_sys (owned by a system role) — skipped. It only holds PostGIS map projection data.';
  END;
END $$;

-- ── CHECK (run manually afterwards; read-only) ───────────────
-- Policies still calling auth functions per row (should return no rows):
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(?<!SELECT )auth\.(uid|role|jwt|email)\(\)';
