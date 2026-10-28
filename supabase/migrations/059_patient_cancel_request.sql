-- ============================================================
-- Migration 059: patients can cancel a request before it's accepted
--
-- The waiting screen (design: "Waiting for accept") offers Cancel request.
-- Patients pay before dispatch, so a cancelled paid booking needs its money
-- returned. This records that; nothing is refunded automatically:
--
--   cancelled_at   when the patient cancelled
--   refund_status  'due' when a paid booking was cancelled, 'refunded' once
--                  finance has returned the money (set from the admin side)
--
-- Cancelling is done by the patient app's API with the service role, only
-- while the booking is still pending_payment, pending or paid (accept_dispatch
-- only accepts 'paid' bookings, so a cancelled one can't be taken).
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_status text
  CHECK (refund_status IS NULL OR refund_status IN ('due', 'refunded'));

CREATE INDEX IF NOT EXISTS bookings_refund_due_idx ON bookings (refund_status) WHERE refund_status = 'due';
