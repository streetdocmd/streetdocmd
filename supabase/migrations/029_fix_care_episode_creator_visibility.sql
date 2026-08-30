-- ============================================================
-- Migration 029: Fix care_episodes creator visibility (live-tested bug)
--
-- care_episodes_select only granted SELECT to the patient or an active
-- care_team_member. Creating an episode is two inserts from the client
-- (care_episodes, then care_team_members) — at the moment PostgREST does
-- its implicit RETURNING-select after the first insert, the creator
-- isn't in care_team_members yet (that's the second insert) and isn't
-- the patient either, so RLS blocks the read-back and the whole request
-- surfaces as "new row violates row-level security policy," even though
-- the row was actually inserted. Live-tested via Playwright driving a
-- real doctor test account through "Start a care episode."
--
-- Fix: a provider can always see an episode they created, independent of
-- current team membership.
-- ============================================================

DROP POLICY IF EXISTS care_episodes_select ON care_episodes;
CREATE POLICY care_episodes_select ON care_episodes
  FOR SELECT USING (
    patient_id = auth.uid()
    OR is_care_team_member(id)
    OR created_by IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR get_user_role() = 'admin'
  );
