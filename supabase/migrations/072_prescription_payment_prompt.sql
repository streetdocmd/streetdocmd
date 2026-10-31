-- ============================================================
-- Migration 072: The patient reviews a prescription before a pharmacy sees it
--
-- A prescription is free text, so it can name anything, including medicines
-- no partner pharmacy stocks. The patient is prompted to review it, removes
-- what they already have at home, and only then is the rest sent to a
-- pharmacy ('sent'). The pharmacy prices what it can supply
-- ('pending_payment') and the patient pays.
--
--   prescriptions.patient_reviewed_at   set once they've ordered, or told us
--                                       they have everything. Cleared if the
--                                       pharmacy can't supply anything, so the
--                                       prompt comes back.
--   prescription_orders.prescription_id the prescription an order came from
--   prescription_orders.delivery_address where the rider goes
-- ============================================================

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_reviewed_at timestamptz;
ALTER TABLE prescription_orders ADD COLUMN IF NOT EXISTS prescription_id uuid REFERENCES prescriptions(id) ON DELETE SET NULL;
ALTER TABLE prescription_orders ADD COLUMN IF NOT EXISTS delivery_address text;
CREATE INDEX IF NOT EXISTS prescription_orders_prescription_idx ON prescription_orders(prescription_id);

-- New prescriptions reach the patient's home screen without a reload
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications never name the medicines
CREATE OR REPLACE FUNCTION public.notify_prescription_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM notify(NEW.patient_id, 'orders', 'Your doctor prescribed medicines',
    'Review the list and remove anything you already have. We''ll then send the rest to a pharmacy.',
    '/dashboard/prescriptions/' || NEW.id, 'patient');
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS prescriptions_notify ON prescriptions;
CREATE TRIGGER prescriptions_notify AFTER INSERT ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION notify_prescription_created();

-- Patient placed orders start at pending_payment on INSERT, while they're
-- already on the payment screen, so they get no prompt.
CREATE OR REPLACE FUNCTION public.notify_prescription_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ph   text;
  v_link text := '/dashboard/medications/' || NEW.id;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  SELECT name INTO v_ph FROM pharmacy_partners WHERE id = NEW.pharmacy_partner_id;
  v_ph := COALESCE(v_ph, 'Your pharmacy');

  CASE NEW.status
    WHEN 'sent' THEN
      PERFORM notify_facility('pharmacy', NEW.pharmacy_partner_id, 'orders', 'New prescription',
        'Price what you can supply so the patient can pay.', '/pharmacy-portal/dashboard/' || NEW.id);
    WHEN 'pending_payment' THEN
      IF TG_OP = 'UPDATE' THEN
        PERFORM notify(NEW.patient_id, 'payments', 'Your medicines are ready to pay for',
          v_ph || ' has priced your prescription. Pay to have it delivered.', v_link, 'patient');
      END IF;
    WHEN 'confirmed' THEN
      PERFORM notify(NEW.patient_id, 'orders', v_ph || ' confirmed your order', 'They''re preparing your medicines.', v_link, 'patient');
    WHEN 'dispatched' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your medicines are on the way', v_ph || ' has sent your order out for delivery.', v_link, 'patient');
    WHEN 'delivered' THEN
      PERFORM notify(NEW.patient_id, 'orders', 'Your medicines were delivered',
        'How was your order from ' || v_ph || '? Leave a quick rating.', '/dashboard/rate/pharmacy/' || NEW.id, 'patient');
    WHEN 'cancelled' THEN
      IF NEW.prescription_id IS NOT NULL AND NEW.payment_status <> 'paid' THEN
        PERFORM notify(NEW.patient_id, 'orders', v_ph || ' can''t supply your prescription',
          'Open StreetdocMD to try another pharmacy.', '/dashboard/prescriptions/' || NEW.prescription_id, 'patient');
      ELSE
        PERFORM notify(NEW.patient_id, 'orders', 'Your medicine order was cancelled',
          'If you paid, we''ll refund you. Contact us if you have questions.', v_link, 'patient');
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% failed: %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;
