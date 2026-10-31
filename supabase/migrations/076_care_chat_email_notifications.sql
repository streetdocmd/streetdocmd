-- ============================================================
-- Migration 076: Care chat messages reach people by email too
--
-- Chat notifications were push only, and push needs each person to switch it
-- on in their browser, so most never heard about new messages. Now the first
-- message in a while also sends an email. Later messages in the same care
-- journey stay push and inbox only for 30 minutes, so a busy chat can't flood
-- anyone's mailbox.
--
-- Emailed notifications don't carry the message: chats discuss patients, and
-- email isn't a place for clinical detail.
-- ============================================================

CREATE OR REPLACE FUNCTION public.care_journey_message_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_link text;
  v_email boolean;
BEGIN
  IF NEW.kind <> 'message' THEN RETURN NULL; END IF;
  FOR r IN SELECT * FROM public.care_chat_members(NEW.care_episode_id) LOOP
    IF r.user_id IS DISTINCT FROM NEW.sender_user_id THEN
      v_link := CASE r.app WHEN 'provider' THEN '/dashboard/journeys/' ELSE '/' || r.app || '-portal/journeys/' END || NEW.care_episode_id;
      v_email := NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = r.user_id AND n.link = v_link AND 'email' = ANY (n.channels)
          AND n.created_at > now() - interval '30 minutes'
      );
      PERFORM notify(r.user_id, 'visits', 'New message from ' || split_part(NEW.sender_label, ' · ', 1),
        CASE WHEN v_email THEN 'Open StreetdocMD to read it and reply.' ELSE left(NEW.body, 120) END,
        v_link, r.app, CASE WHEN v_email THEN '{email,push}'::text[] ELSE '{push}'::text[] END);
    END IF;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'care_journey_message_notify failed: %', SQLERRM;
  RETURN NULL;
END;
$function$;
