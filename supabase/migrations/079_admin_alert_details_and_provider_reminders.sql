-- ============================================================
-- Migration 079: Admin alerts say who they're about, and providers get a
-- morning reminder
--
-- 1. Admin alert emails used to be one line ("A provider asked to withdraw
--    ₦20,000."). They now carry a short list of details: the patient or
--    provider's name, phone and email, and the amount, facility or order
--    involved. The list travels in notifications.data.details and the
--    send-notification function shows it as a table under the message.
--    Push notifications stay one line. No clinical detail goes into email.
--
--    The six trigger functions below are copied from the live database
--    (pg_get_functiondef) with only their notify_admins call changed.
--
-- 2. Every morning at 7:00 (Lagos), verified providers who haven't set a rate
--    for every service they're booked for get an email and push asking them
--    to. Those whose rates are complete but who are offline get a reminder to
--    turn on their availability.
-- ============================================================

-- Admin alert with a details list ([label, value] pairs; empty values are skipped when shown)
CREATE OR REPLACE FUNCTION public.notify_admins_details(p_title text, p_body text, p_link text, p_details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM users WHERE role = 'admin' LOOP
    PERFORM public.notify(r.id, 'admin', p_title, p_body, p_link, 'admin', '{email,push}',
      jsonb_build_object('details', COALESCE(p_details, '[]'::jsonb)));
  END LOOP;
END;
$$;

-- Name, phone and email of a person, labelled ("Patient", "Patient phone", ...).
-- Never fails: an alert without details beats no alert.
CREATE OR REPLACE FUNCTION public.admin_person_details(p_label text, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_array(
    jsonb_build_array(p_label, u.name),
    jsonb_build_array(p_label || ' phone', u.phone),
    jsonb_build_array(p_label || ' email', u.email))
  INTO v FROM users u WHERE u.id = p_user;
  RETURN COALESCE(v, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN '[]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.investigation_admin_details(p_order uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o record; v jsonb;
BEGIN
  SELECT * INTO o FROM investigation_orders WHERE id = p_order;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  v := admin_person_details('Patient', o.patient_id) || jsonb_build_array(
    jsonb_build_array('Contact phone', o.contact_phone),
    jsonb_build_array('Lab', (SELECT name FROM lab_partners WHERE id = o.lab_partner_id)),
    jsonb_build_array('Tests', CASE WHEN jsonb_typeof(o.tests) = 'array'
      THEN (SELECT string_agg(t->>'test_name', ', ') FROM jsonb_array_elements(o.tests) t) END),
    jsonb_build_array('Order', left(o.id::text, 8)))
    || admin_person_details('Ordered by', provider_user(o.provider_id));
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN '[]'::jsonb;
END;
$$;

-- notify_provider_account: current definition, admin alert now carries details
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
      PERFORM notify(NEW.user_id, 'account', 'Your application wasn''t approved', 'Open StreetdocMD to see why and what you can do next.', '/onboarding/pending', 'provider');
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

-- notify_withdrawal: current definition, admin alert now carries details
CREATE OR REPLACE FUNCTION public.notify_withdrawal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_amt text := '₦' || to_char(NEW.amount, 'FM999,999,999');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins_details('Payout requested', 'A provider asked to withdraw ' || v_amt || '.', '/dashboard/finance',
      admin_person_details('Provider', provider_user(NEW.provider_id)) || jsonb_build_array(
        jsonb_build_array('Amount', v_amt),
        jsonb_build_array('Bank', NEW.bank_name),
        jsonb_build_array('Account name', NEW.account_name),
        jsonb_build_array('Account ending', right(NEW.account_number, 4))));
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  CASE NEW.status
    WHEN 'approved' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout approved', 'Your withdrawal of ' || v_amt || ' is approved and will be sent on the payout day.', '/dashboard/earnings', 'provider');
    WHEN 'processed' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout sent', v_amt || ' has been sent to your bank account.', '/dashboard/earnings', 'provider');
    WHEN 'failed' THEN
      PERFORM notify(provider_user(NEW.provider_id), 'payments', 'Payout failed', 'We couldn''t send ' || v_amt || '. Check your bank details and try again.', '/dashboard/earnings', 'provider');
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

-- notify_booking_change: current definition, admin alert now carries details
CREATE OR REPLACE FUNCTION public.notify_booking_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pname text;
  v_link  text := '/dashboard/book/tracking/' || NEW.id;
BEGIN
  SELECT name INTO v_pname FROM providers WHERE id = NEW.provider_id;
  v_pname := COALESCE(v_pname, 'Your provider');

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'paid' THEN
        PERFORM notify(NEW.patient_id, 'payments', 'Payment received',
          'Thanks, your payment went through. We''re matching you with a provider now.', v_link, 'patient');
      WHEN 'accepted' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' accepted your visit',
          'You can follow their progress and contact them from your visit page.', v_link, 'patient');
      WHEN 'en_route' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' is on the way',
          'Track them live from your visit page.', v_link, 'patient', '{push}');
      WHEN 'arrived' THEN
        PERFORM notify(NEW.patient_id, 'visits', v_pname || ' has arrived',
          'Your provider is at your address.', v_link, 'patient', '{push}');
      WHEN 'completed' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'Your visit is complete',
          'Your visit record is ready. Tell us how it went with a quick rating.', '/dashboard/book/rate/' || NEW.id, 'patient');
      WHEN 'cancelled' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'Your visit was cancelled',
          'If you paid, we''ll refund you. You can book again at any time.', '/dashboard/bookings', 'patient');
        IF NEW.provider_id IS NOT NULL AND OLD.status IN ('accepted', 'en_route', 'arrived') THEN
          PERFORM notify(provider_user(NEW.provider_id), 'visits', 'A visit was cancelled',
            'The patient cancelled a visit you had accepted. You don''t need to travel.', '/dashboard', 'provider');
        END IF;
      WHEN 'expired', 'provider_declined' THEN
        PERFORM notify(NEW.patient_id, 'visits', 'We couldn''t find a provider',
          'No provider was free for your request. If you paid, we''ll refund you. Please try again soon.', '/dashboard/bookings', 'patient');
      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.refund_status = 'due' AND OLD.refund_status IS DISTINCT FROM 'due' THEN
    PERFORM notify_admins_details('Refund due', 'A paid visit was cancelled and needs a refund.', '/dashboard/finance',
      admin_person_details('Patient', NEW.patient_id) || admin_person_details('Provider', provider_user(NEW.provider_id)) || jsonb_build_array(
        jsonb_build_array('Visit', initcap(replace(NEW.service_type::text, '_', ' '))),
        jsonb_build_array('Amount paid', '₦' || to_char(NEW.fee + COALESCE(NEW.service_charge, 0), 'FM999,999,999')),
        jsonb_build_array('Booking', left(NEW.id::text, 8))));
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

-- notify_admin_event: current definition, admin alert now carries details
CREATE OR REPLACE FUNCTION public.notify_admin_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'safeguarding_alerts' THEN
    PERFORM notify_admins_details('Safeguarding alert', 'A clinical encounter was flagged for safeguarding review.', '/dashboard/safeguarding',
      admin_person_details('Patient', NEW.patient_id) || admin_person_details('Provider', provider_user(NEW.provider_id)));
  ELSIF TG_TABLE_NAME = 'facility_applications' THEN
    PERFORM notify_admins_details('New facility application', 'A pharmacy, lab or hospital applied to join.', '/dashboard/facilities',
      jsonb_build_array(
        jsonb_build_array('Facility', NEW.name),
        jsonb_build_array('Type', initcap(NEW.facility_type::text)),
        jsonb_build_array('Contact person', NULLIF(concat_ws(', ', NEW.contact_person_name, NEW.contact_person_role), '')),
        jsonb_build_array('Phone', NEW.phone),
        jsonb_build_array('Email', NEW.email),
        jsonb_build_array('Location', NULLIF(concat_ws(', ', NEW.address, NEW.city, NEW.state), '')),
        jsonb_build_array('Registration no.', NEW.registration_number)));
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

-- notify_investigation_order: current definition, admin alert now carries details
CREATE OR REPLACE FUNCTION public.notify_investigation_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lab   text;
  v_link  text := '/dashboard/investigations/' || NEW.id;
  v_first text;
  v_doctor uuid := provider_user(NEW.provider_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'awaiting_patient_approval' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your doctor requested tests',
        'Review the tests and the cost, then approve and pay to arrange collection.', v_link, 'patient');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.lab_partner_id IS NOT DISTINCT FROM OLD.lab_partner_id THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_lab FROM lab_partners WHERE id = NEW.lab_partner_id;
  v_lab := COALESCE(v_lab, 'The lab');
  SELECT split_part(COALESCE(name, 'your patient'), ' ', 1) INTO v_first FROM users WHERE id = NEW.patient_id;

  CASE NEW.status
    WHEN 'paid_awaiting_lab' THEN
      PERFORM notify(NEW.patient_id, 'payments', 'Payment received for your tests', 'We are confirming a lab for your sample collection.', v_link, 'patient');
    WHEN 'lab_requested' THEN
      PERFORM notify_facility('lab', NEW.lab_partner_id, 'orders', 'New test request',
        'Accept or decline within 30 minutes, or it moves to another lab.', '/lab-portal/dashboard/' || NEW.id);
    WHEN 'lab_accepted' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_lab || ' accepted your tests',
        CASE WHEN NEW.collection_method = 'doctor' THEN 'Your sample is on its way to the lab.' ELSE 'They will confirm a time to collect your sample.' END, v_link, 'patient');
    WHEN 'collection_scheduled' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Sample collection booked',
        'Open StreetdocMD to see when the collector will arrive.', v_link, 'patient');
    WHEN 'sample_collected' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your sample was collected', 'We will let you know when results are ready.', v_link, 'patient', '{push}');
    WHEN 'results_uploaded' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your test results are ready',
        'Open StreetdocMD to view them securely.', v_link, 'patient');
    WHEN 'doctor_review_pending' THEN
      PERFORM notify(v_doctor, 'orders',
        CASE WHEN NEW.has_critical THEN 'Urgent: results need your review' ELSE 'Results ready for ' || COALESCE(v_first, 'your patient') END,
        'Review the results you ordered and record next steps.', '/dashboard/investigations/' || NEW.id, 'provider');
    WHEN 'reviewed', 'follow_up_required' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your doctor reviewed your results',
        'Open StreetdocMD to read their notes and next steps.', v_link, 'patient');
    WHEN 'exception' THEN
      PERFORM notify_admins_details('Investigation needs attention', COALESCE(NEW.exception_reason, 'An investigation order needs operations follow up.'), '/dashboard/labs',
        investigation_admin_details(NEW.id));
    ELSE NULL;
  END CASE;

  IF NEW.status = 'results_uploaded' AND NEW.has_critical THEN
    PERFORM notify_admins_details('Critical result uploaded', 'A lab marked a result as critical. Make sure the patient is contacted.', '/dashboard/labs',
      investigation_admin_details(NEW.id));
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

-- care_report_request_notify: current definition, admin alert now carries details
CREATE OR REPLACE FUNCTION public.care_report_request_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_admins_details('Medical report requested', 'A ' || NEW.requester_role || ' asked for a care journey report.', '/dashboard/reports',
      admin_person_details('Requested by', NEW.requested_by) || jsonb_build_array(
        jsonb_build_array('Role', NEW.requester_role),
        jsonb_build_array('Patient', (SELECT u.name FROM care_episodes e JOIN users u ON u.id = e.patient_id WHERE e.id = NEW.care_episode_id)),
        jsonb_build_array('Reason', NEW.reason)));
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM notify(NEW.requested_by, 'account',
      CASE WHEN NEW.status = 'approved' THEN 'Your medical report is ready' ELSE 'Your medical report request was not approved' END,
      CASE WHEN NEW.status = 'approved' THEN 'Open StreetdocMD to download it.' ELSE COALESCE(NEW.review_note, 'Contact StreetdocMD support for details.') END,
      CASE WHEN NEW.requester_role = 'patient' THEN '/dashboard/my-care' ELSE '/dashboard/journeys/' || NEW.care_episode_id END,
      CASE WHEN NEW.requester_role = 'patient' THEN 'patient' ELSE 'provider' END);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$function$;

-- ── Morning reminder for providers ──────────────────────────
-- The services each profession is booked for, and so must have a rate for
-- (rateTypesFor in provider-web; Wellness Check is priced by its package).
CREATE OR REPLACE FUNCTION public.provider_morning_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_missing text;
  v_sent integer := 0;
BEGIN
  FOR r IN SELECT id, user_id, profession, available FROM providers WHERE verification_status = 'verified' LOOP
    SELECT string_agg(s.label, ', ' ORDER BY s.ord) INTO v_missing
    FROM (VALUES
      ('doctor', 'general_consultation', 'General Consultation', 1),
      ('doctor', 'elderly_review', 'Elderly Review', 2),
      ('doctor', 'custom_request', 'Custom Request', 3),
      ('nurse', 'wound_care', 'Wound Care', 1),
      ('nurse', 'nursing_care', 'Nursing Care', 2),
      ('physiotherapist', 'physiotherapy_assessment', 'Physiotherapy Assessment', 1),
      ('physiotherapist', 'physiotherapy_session', 'Physiotherapy Session', 2)
    ) AS s(profession, service_type, label, ord)
    WHERE s.profession = r.profession::text
      AND NOT EXISTS (
        SELECT 1 FROM provider_services ps
        WHERE ps.provider_id = r.id AND ps.service_type::text = s.service_type AND ps.active AND ps.price > 0
      );

    IF v_missing IS NOT NULL THEN
      PERFORM notify(r.user_id, 'account', 'Set your rates so patients can book you',
        'Patients can''t book you yet because you haven''t set your price for: ' || v_missing || '. It takes a minute.',
        '/dashboard/services', 'provider');
      v_sent := v_sent + 1;
    ELSIF NOT COALESCE(r.available, false) THEN
      PERFORM notify(r.user_id, 'account', 'Ready for visits today?',
        'You''re offline, so patients can''t send you visit requests. Turn on your availability whenever you''re ready to take visits.',
        '/dashboard', 'provider');
      v_sent := v_sent + 1;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('provider-morning-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
-- 06:00 UTC is 07:00 in Lagos
SELECT cron.schedule('provider-morning-reminders', '0 6 * * *', $$SELECT public.provider_morning_reminders()$$);

REVOKE ALL ON FUNCTION public.notify_admins_details(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_person_details(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.investigation_admin_details(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provider_morning_reminders() FROM PUBLIC, anon, authenticated;
