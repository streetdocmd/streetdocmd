-- ============================================================
-- Migration 069: investigation_orders.payment_status, made consistent
--
-- The live database already had a payment_status column on
-- investigation_orders (added outside these migrations, with values such as
-- 'pending'), so 067's ADD COLUMN IF NOT EXISTS kept the old column and its
-- rules. This puts it on 067's footing:
--   unpaid        not paid yet (orders still before payment)
--   paid          confirmed by the Paystack webhook
--   not_required  orders from before payments through StreetdocMD
-- ============================================================

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.investigation_orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.investigation_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE investigation_orders SET payment_status = CASE
  WHEN payment_status = 'paid' AND paid_at IS NOT NULL THEN 'paid'
  WHEN status IN ('draft', 'awaiting_patient_approval', 'declined_by_patient', 'awaiting_payment', 'payment_failed') THEN 'unpaid'
  ELSE 'not_required'
END
WHERE payment_status IS NULL OR payment_status NOT IN ('unpaid', 'paid', 'not_required')
   OR (payment_status = 'paid' AND paid_at IS NULL);

ALTER TABLE investigation_orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE investigation_orders ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE investigation_orders ADD CONSTRAINT investigation_orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid', 'not_required'));
