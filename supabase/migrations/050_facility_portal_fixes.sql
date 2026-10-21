-- ============================================================
-- Migration 050: Partner-portal access fixes (run after 047)
--
-- Facilities now get a portal login (role lab_staff / pharmacy_staff /
-- hospital_staff) the moment they REGISTER, before anyone has reviewed
-- them. Two existing holes become exploitable by any member of the public
-- who fills in the registration form:
--
--   1. Staff RLS was role-wide, not facility-scoped. Migrations 013/014/023
--      let ANY lab_staff read and write EVERY investigation order/result and
--      ANY pharmacy_staff read and write EVERY prescription order/delivery,
--      including patient names, phone numbers and clinical notes. A pending
--      applicant had all of that from day one via the public API.
--      Fix: RESTRICTIVE policies (AND-ed with every existing permissive
--      policy) that confine each staff role to rows of the facility it is
--      linked to via lab_staff / pharmacy_staff / hospital_staff. No staff
--      link (pending, rejected, unlinked) = no rows. Patients, providers and
--      admins are untouched; the service role bypasses RLS as before (the
--      portal APIs use it and do their own ownership checks).
--
--   2. Role self-escalation (anyone could make themselves 'admin') is fixed
--      by 048's users_guard_role trigger; see section 2 below.
--
-- Additive and idempotent: only creates policies/a trigger, never drops
-- or rewrites existing ones.
-- ============================================================

-- ── 1. FACILITY-SCOPED STAFF ACCESS ─────────────────────────

-- Lab staff: only orders for their own lab
DROP POLICY IF EXISTS inv_orders_lab_staff_scope ON investigation_orders;
CREATE POLICY inv_orders_lab_staff_scope ON investigation_orders
  AS RESTRICTIVE FOR ALL
  USING (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR lab_partner_id IN (SELECT ls.lab_partner_id FROM lab_staff ls WHERE ls.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR lab_partner_id IN (SELECT ls.lab_partner_id FROM lab_staff ls WHERE ls.user_id = auth.uid())
  );

DROP POLICY IF EXISTS inv_results_lab_staff_scope ON investigation_results;
CREATE POLICY inv_results_lab_staff_scope ON investigation_results
  AS RESTRICTIVE FOR ALL
  USING (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR EXISTS (
      SELECT 1 FROM investigation_orders io
      JOIN lab_staff ls ON ls.lab_partner_id = io.lab_partner_id
      WHERE io.id = investigation_results.order_id AND ls.user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() IS DISTINCT FROM 'lab_staff'
    OR EXISTS (
      SELECT 1 FROM investigation_orders io
      JOIN lab_staff ls ON ls.lab_partner_id = io.lab_partner_id
      WHERE io.id = investigation_results.order_id AND ls.user_id = auth.uid()
    )
  );

-- Pharmacy staff: only orders for their own pharmacy
DROP POLICY IF EXISTS rx_orders_pharmacy_staff_scope ON prescription_orders;
CREATE POLICY rx_orders_pharmacy_staff_scope ON prescription_orders
  AS RESTRICTIVE FOR ALL
  USING (
    get_user_role() IS DISTINCT FROM 'pharmacy_staff'
    OR pharmacy_partner_id IN (SELECT ps.pharmacy_partner_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IS DISTINCT FROM 'pharmacy_staff'
    OR pharmacy_partner_id IN (SELECT ps.pharmacy_partner_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid())
  );

DROP POLICY IF EXISTS delivery_tracking_pharmacy_staff_scope ON delivery_tracking;
CREATE POLICY delivery_tracking_pharmacy_staff_scope ON delivery_tracking
  AS RESTRICTIVE FOR ALL
  USING (
    get_user_role() IS DISTINCT FROM 'pharmacy_staff'
    OR EXISTS (
      SELECT 1 FROM prescription_orders po
      JOIN pharmacy_staff ps ON ps.pharmacy_partner_id = po.pharmacy_partner_id
      WHERE po.id = delivery_tracking.prescription_order_id AND ps.user_id = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role() IS DISTINCT FROM 'pharmacy_staff'
    OR EXISTS (
      SELECT 1 FROM prescription_orders po
      JOIN pharmacy_staff ps ON ps.pharmacy_partner_id = po.pharmacy_partner_id
      WHERE po.id = delivery_tracking.prescription_order_id AND ps.user_id = auth.uid()
    )
  );

-- Hospital staff: only referrals to their own hospital. hospital_referrals and
-- hospital_staff exist in the live DB but were never created by a repo
-- migration, so this is guarded on both tables (and the columns the app uses)
-- existing. Note: a RESTRICTIVE policy only takes effect if RLS is enabled
-- on hospital_referrals — see the check query at the bottom.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'hospital_referrals' AND column_name = 'hospital_partner_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'hospital_staff' AND column_name = 'hospital_partner_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS hospital_referrals_hospital_staff_scope ON hospital_referrals';
    EXECUTE $p$
      CREATE POLICY hospital_referrals_hospital_staff_scope ON hospital_referrals
        AS RESTRICTIVE FOR ALL
        USING (
          get_user_role() IS DISTINCT FROM 'hospital_staff'
          OR hospital_partner_id IN (SELECT hs.hospital_partner_id FROM hospital_staff hs WHERE hs.user_id = auth.uid())
        )
        WITH CHECK (
          get_user_role() IS DISTINCT FROM 'hospital_staff'
          OR hospital_partner_id IN (SELECT hs.hospital_partner_id FROM hospital_staff hs WHERE hs.user_id = auth.uid())
        )
    $p$;
  ELSE
    RAISE NOTICE '050: hospital_referrals/hospital_staff not found with expected columns; hospital scope policy skipped';
  END IF;
END $$;

-- ── 2. NO SELF-SERVICE ROLE CHANGES ─────────────────────────
-- Handled by 048_patient_onboarding_fixes.sql (users_guard_role trigger),
-- which blocks client-side role changes and non-patient inserts. Removed here
-- to avoid two triggers doing the same job. Drop the earlier copy in case
-- a draft of this migration was already applied.
DROP TRIGGER IF EXISTS users_prevent_self_role_escalation ON users;
DROP FUNCTION IF EXISTS prevent_self_role_escalation();

-- ── CHECK (run manually after applying; read-only) ──────────
-- Is RLS on for the hospital tables that predate the repo's migrations?
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('hospital_referrals', 'hospital_staff', 'hospital_partners', 'facility_applications');
-- Any table showing relrowsecurity = false is readable by every signed-in user.
