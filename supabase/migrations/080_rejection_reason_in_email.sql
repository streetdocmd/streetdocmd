-- ============================================================
-- Migration 080: Rejection emails say why
--
-- A rejected provider's email and push only said to open StreetdocMD to see
-- why. They now carry the reason the reviewer wrote (providers.rejection_reason,
-- saved in the same update as the status), so the provider knows what to fix
-- without signing in. With no reason recorded, the old wording stays.
--
-- The function is the live definition (pg_get_functiondef) with only that
-- notify call changed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_provider_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins_details('New provider to verify', NEW.name || ' registered and is waiting for verification.', '/dashboard/providers/' || NEW.id,
      jsonb_build_array(
        jsonb_build_array('Name', NEW.name),
        jsonb_build_array('Specialty', concat_ws(' · ', NEW.specialty, NEW.specialist_field)),
        jsonb_build_array('Phone', NEW.phone),
        jsonb_build_array('Email', (SELECT email FROM users WHERE id = NEW.user_id)),
        jsonb_build_array('Licence', NULLIF(concat_ws(' ', NEW.license_body, NEW.license_number), '')),
        jsonb_build_array('Experience', NEW.years_experience || ' years')));
    RETURN NULL;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'verified' THEN
      PERFORM notify(NEW.user_id, 'account', 'You''re verified', 'Your StreetdocMD account is approved. Go online to start receiving visits.', '/dashboard', 'provider');
    ELSIF NEW.verification_status = 'rejected' THEN
      PERFORM notify(NEW.user_id, 'account', 'Your application wasn''t approved',
        CASE WHEN NULLIF(btrim(NEW.rejection_reason), '') IS NOT NULL
          THEN 'Reason: ' || btrim(NEW.rejection_reason)
            || CASE WHEN right(btrim(NEW.rejection_reason), 1) IN ('.', '!', '?') THEN '' ELSE '.' END
            || ' You can update your documents and apply again on StreetdocMD.'
          ELSE 'Open StreetdocMD to see why and what you can do next.' END,
        '/onboarding/pending', 'provider');
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;
