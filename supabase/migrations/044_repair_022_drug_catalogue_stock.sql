-- ============================================================
-- Migration 044: Repair drift from migration 022
--
-- 022_pharmacy_inventory.sql is marked "applied" in this database's own
-- migration-history table (from an earlier `supabase migration repair`
-- that bulk-marked 001-035 as applied after spot-checking only a sample
-- of them against real schema state — 022 wasn't in that sample and, it
-- turns out, was never actually run here: drug_catalogue.stock_quantity
-- does not exist on the live table). Re-applying 022's own DDL directly
-- under a new migration number, since the CLI won't re-run a version
-- already recorded as applied. Content is identical to 022, and equally
-- additive/idempotent.
-- ============================================================

ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS stock_quantity int NOT NULL DEFAULT 0;
ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

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
