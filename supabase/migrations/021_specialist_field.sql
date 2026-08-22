-- ============================================================
-- Migration 021: Specialist doctors declare their field
--
-- "Medical Doctor (Specialist)" previously had no way to record which
-- field the doctor specializes in (e.g. Cardiology, Paediatrics). Adds a
-- single free-text column — additive only, nothing dropped or renamed.
-- ============================================================

ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialist_field text;
