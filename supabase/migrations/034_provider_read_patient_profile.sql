-- ============================================================
-- Migration 034: Let a provider read the profile of a patient they
-- have a booking with
--
-- users_self_read (migration 001) only ever allowed a user to read
-- their own row (or an admin, any row). There has never been a policy
-- letting a provider read a *patient's* users row — so every
-- provider-web query that embeds users!patient_id(...) on a booking
-- (via the provider's own session, not the admin client) silently gets
-- a null patient back under RLS, even though the booking itself is
-- visible.
--
-- Concretely this broke: patient name/details never showing up on the
-- doctor/nurse/physio note-taking screens, and — more seriously — the
-- patientId sent when submitting a note/encounter was always empty,
-- so the patient-facing visit summary was never created. Verified
-- against production: only 3 of 23 completed bookings had a
-- visit_summaries row before this fix.
--
-- Mirrors the existing booking-linked-access idiom already used by
-- visits_access (migration 001) — additive PERMISSIVE policy, OR'd
-- with users_self_read, so it only ever grants more read access, never
-- takes any away.
-- ============================================================

CREATE POLICY users_provider_read_patient ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN providers p ON p.id = b.provider_id
      WHERE b.patient_id = users.id AND p.user_id = auth.uid()
    )
  );
