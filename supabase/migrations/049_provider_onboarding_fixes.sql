-- ============================================================
-- Migration 049: Provider onboarding fixes
--
-- Run AFTER 046_provider_service_agreement.sql (the provider portal
-- reads providers.agreement_version on every onboarding screen).
--
--   1. provider_registration_answers — the registration form has always
--      asked "what would you consider a reasonable amount per booking?" and
--      "any questions or suggestions?", but /api/register silently dropped
--      both answers. They get their own admin-only table rather than new
--      providers columns, because verified providers rows are readable by
--      every signed-in user (providers_public_read).
--
--   2. Verification gate hardening. providers_self_write / providers_insert_own
--      let a provider write ANY column of their own row with the anon key —
--      including verification_status, so an applicant could mark themselves
--      verified from the browser console and start receiving patients. A
--      BEFORE trigger now keeps verification_status / badge_issued /
--      rejection_reason under platform control for direct client writes.
--      Service-role calls (admin portal, provider-web API routes), SECURITY
--      DEFINER functions, nested trigger writes and admin users are unaffected.
--
--   3. provider-docs storage. Migration 005 created the bucket PUBLIC with
--      a SELECT policy letting any signed-in user (any patient) list and read
--      every provider's licence and degree certificate. Code has used signed
--      URLs since the bucket "became private" (admin portal), but nothing
--      ever actually flipped the existing bucket. Uploads go through the
--      provider-web service-role route, so the broad client policies are
--      replaced with owner-scoped ones.
-- ============================================================

-- ── 1. REGISTRATION ANSWERS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_registration_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  expected_rate numeric(12,2) CHECK (expected_rate IS NULL OR expected_rate >= 0),
  questions     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_registration_answers_provider_idx
  ON provider_registration_answers(provider_id);

ALTER TABLE provider_registration_answers ENABLE ROW LEVEL SECURITY;

-- Written only by the service-role /api/register route; read by admins.
DO $$ BEGIN
  CREATE POLICY provider_registration_answers_admin_read ON provider_registration_answers
    FOR SELECT USING (get_user_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. VERIFICATION GATE ─────────────────────────────────────

CREATE OR REPLACE FUNCTION protect_provider_verification_fields()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only direct writes from client sessions are restricted. current_user is
  -- 'service_role' for API routes and the function owner inside SECURITY
  -- DEFINER functions; pg_trigger_depth() > 1 means another trigger is writing.
  IF current_user NOT IN ('authenticated', 'anon')
     OR pg_trigger_depth() > 1
     OR coalesce(get_user_role(), '') = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending';
    NEW.badge_issued := false;
    NEW.rejection_reason := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.badge_issued := OLD.badge_issued;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_protect_verification ON providers;
CREATE TRIGGER providers_protect_verification
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION protect_provider_verification_fields();

-- ── 3. PROVIDER-DOCS STORAGE ─────────────────────────────────

UPDATE storage.buckets SET public = false WHERE id = 'provider-docs';

DROP POLICY IF EXISTS "providers_upload_docs" ON storage.objects;
DROP POLICY IF EXISTS "providers_read_docs" ON storage.objects;

-- Objects are stored as "<provider_id>/<doc_type>_<timestamp>.<ext>".
DO $$ BEGIN
  CREATE POLICY provider_docs_owner_read ON storage.objects
    FOR SELECT USING (
      bucket_id = 'provider-docs'
      AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.providers WHERE user_id = auth.uid())
        OR public.get_user_role() = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY provider_docs_owner_insert ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'provider-docs'
      AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.providers WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
