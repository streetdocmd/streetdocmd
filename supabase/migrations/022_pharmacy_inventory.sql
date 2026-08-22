-- ============================================================
-- Migration 022: Pharmacy inventory foundation
--
-- drug_catalogue already existed (price, in_stock boolean per drug per
-- pharmacy) but had no quantity concept and no scoped RLS — the existing
-- "pharmacy_staff can manage drug_catalogue" policy doesn't check WHICH
-- pharmacy, so any pharmacy_staff member could edit any pharmacy's
-- catalogue. That was harmless with no UI to exploit it; it stops being
-- harmless once the pharmacy-portal inventory page ships.
--
-- 1. Adds stock_quantity + updated_at (additive only).
-- 2. Scopes drug_catalogue_manage to the caller's own pharmacy_partner_id.
-- ============================================================

-- ── 1. STOCK QUANTITY + FRESHNESS TRACKING ───────────────────

ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS stock_quantity int NOT NULL DEFAULT 0;
ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 2. SCOPE RLS TO THE CALLER'S OWN PHARMACY ────────────────

DROP POLICY IF EXISTS "drug_catalogue_manage" ON drug_catalogue;
CREATE POLICY "drug_catalogue_manage" ON drug_catalogue
  FOR ALL USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'pharmacy_staff'
      AND pharmacy_partner_id IN (
        SELECT pharmacy_partner_id FROM pharmacy_staff WHERE user_id = auth.uid()
      )
    )
  );
