-- ============================================================
-- Migration 039: Let patients remove a family member
--
-- bookings.family_member_id had no ON DELETE behaviour (defaults to
-- RESTRICT), so a patient could never remove a family member who'd ever
-- been booked for a visit — the exact common case. Switching to SET
-- NULL: the booking row and its own history are untouched, it just
-- stops being attributed to that (now-deleted) family member.
-- ============================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_family_member_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL;
