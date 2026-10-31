-- ============================================================
-- Migration 073: Any test can be listed by a lab or requested by a doctor
--
-- Platform tests are only a shared name, so two labs' "Full Blood Count" count
-- as the same test when orders are matched and priced. They used to be a fixed
-- menu: a lab test outside it could never receive an order. Now the list grows
-- by itself:
--   - a lab adds any test; a new name joins the shared list
--   - a doctor can request a test nobody lists yet. It joins as requested_only
--     (hidden from patients' self service picker), labs are asked to price it,
--     and the patient can pay as soon as a lab near them lists it.
-- Quoting, payment and lab assignment are unchanged.
-- ============================================================

ALTER TABLE investigation_catalogue ADD COLUMN IF NOT EXISTS requested_only boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS investigation_catalogue_platform_name_idx
  ON investigation_catalogue (lower(test_name)) WHERE scope = 'platform';

-- The shared test with this name, created if it's new. Only the service role
-- calls this: lab and doctor routes check who is asking first.
CREATE OR REPLACE FUNCTION public.investigation_platform_test(p_name text, p_requested boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := left(regexp_replace(trim(COALESCE(p_name, '')), '\s+', ' ', 'g'), 200);
  v_id uuid;
  r record;
BEGIN
  IF v_name = '' THEN RETURN NULL; END IF;

  INSERT INTO investigation_catalogue (scope, test_name, price, requested_only)
  VALUES ('platform', v_name, 0, p_requested)
  ON CONFLICT (lower(test_name)) WHERE scope = 'platform' DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM investigation_catalogue WHERE scope = 'platform' AND lower(test_name) = lower(v_name);
    UPDATE investigation_catalogue SET active = true WHERE id = v_id AND NOT active;
    RETURN v_id;
  END IF;

  IF p_requested THEN
    FOR r IN SELECT id FROM lab_partners WHERE active LOOP
      PERFORM notify_facility('lab', r.id, 'orders', 'A doctor requested a test you don''t list',
        'Add ' || v_name || ' to your price list if you offer it.', '/lab-portal/tests');
    END LOOP;
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.investigation_platform_test(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.investigation_platform_test(text, boolean) TO service_role;

-- Lab tests added before this migration
UPDATE investigation_catalogue
SET platform_test_id = public.investigation_platform_test(test_name)
WHERE scope = 'lab_partner' AND platform_test_id IS NULL;

-- A lab listing a test makes it available to patients, and tells anyone whose
-- doctor's order was waiting on the first lab to offer it.
CREATE OR REPLACE FUNCTION public.investigation_test_listed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  UPDATE investigation_catalogue SET requested_only = false WHERE id = NEW.platform_test_id AND requested_only;

  IF EXISTS (
    SELECT 1 FROM investigation_catalogue c
    WHERE c.platform_test_id = NEW.platform_test_id AND c.scope = 'lab_partner' AND c.active AND c.id <> NEW.id
  ) THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT id, patient_id FROM investigation_orders
    WHERE status = 'awaiting_patient_approval'
      AND tests @> jsonb_build_array(jsonb_build_object('platform_test_id', NEW.platform_test_id::text))
  LOOP
    PERFORM notify(r.patient_id, 'orders', 'Your lab test can now be booked',
      'A partner lab has added a test your doctor requested. Open StreetdocMD to see the price.',
      '/dashboard/investigations/' || r.id, 'patient');
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS investigation_catalogue_listed ON investigation_catalogue;
CREATE TRIGGER investigation_catalogue_listed
  AFTER INSERT OR UPDATE OF platform_test_id, active ON investigation_catalogue
  FOR EACH ROW
  WHEN (NEW.scope = 'lab_partner' AND NEW.active AND NEW.platform_test_id IS NOT NULL)
  EXECUTE FUNCTION investigation_test_listed();

NOTIFY pgrst, 'reload schema';
