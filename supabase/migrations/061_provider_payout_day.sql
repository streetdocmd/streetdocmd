-- ============================================================
-- Migration 061: provider payout day
--
-- The provider wallet (design) says when the next payout happens. The day
-- finance runs the weekly payout is a setting, not code: 0 = Sunday ...
-- 5 = Friday (default), 6 = Saturday. Change it here if the payout run moves.
-- ============================================================

INSERT INTO platform_settings (key, value, description)
VALUES ('provider_payout_weekday', to_jsonb(5),
        'Day of the week finance pays out approved provider withdrawals (0 = Sunday, 5 = Friday). Shown on the provider wallet.')
ON CONFLICT (key) DO NOTHING;
