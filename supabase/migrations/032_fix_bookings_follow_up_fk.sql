-- ============================================================
-- Migration 032: Fix missing ON DELETE behaviour on bookings.follow_up_id
--
-- Migration 030 added bookings.follow_up_id with no ON DELETE clause,
-- which defaults to RESTRICT — deleting a follow_ups row (which itself
-- cascades from care_episodes) would be blocked by any booking that
-- references it, in turn blocking the care_episode delete entirely.
-- Found during test-data cleanup, not exercised by any real application
-- flow yet (episodes are closed/resolved via status, not hard-deleted),
-- but worth fixing before any admin tooling relies on being able to
-- delete an episode. Consistent with care_episode_id/preferred_provider_id
-- on the same table, which are already SET NULL.
-- ============================================================

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_follow_up_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_follow_up_id_fkey
  FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id) ON DELETE SET NULL;
