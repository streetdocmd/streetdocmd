-- ============================================================
-- Migration 062: per document review result
--
-- The provider verification screen (design) shows every document with its
-- own status, and when one needs fixing, the reason next to it. Admins set
-- these while reviewing; a re-upload is a new row, which starts as pending.
--
--   review_status  'pending' (default), 'approved', 'needs_info'
--   review_note    why a document needs fixing, shown to the provider
-- ============================================================

ALTER TABLE provider_documents ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'needs_info'));
ALTER TABLE provider_documents ADD COLUMN IF NOT EXISTS review_note text;

-- Documents of providers already verified were approved as a set
UPDATE provider_documents d
SET review_status = 'approved'
FROM providers p
WHERE p.id = d.provider_id
  AND p.verification_status = 'verified'
  AND d.review_status = 'pending';
