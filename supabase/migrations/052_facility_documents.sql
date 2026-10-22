-- ============================================================
-- Migration 052: Facility verification documents
--
-- Facilities (labs, pharmacies, hospitals) can't attach documents on the
-- public registration form. Instead they upload them from their partner
-- portal while the application is pending, and an admin reviews them
-- manually before approving.
--
--   1. facility_documents — one row per uploaded file, tied to the
--      application (cascades when the application is deleted). file_url is
--      the storage path inside the private `facility-docs` bucket, never a
--      public URL; admins view files through short-lived signed URLs.
--
--   2. RLS: admins may read. There are NO client write policies — the portal
--      upload API (apps/admin/src/app/api/facility/documents) uses the
--      service role after checking that the signed-in user owns the
--      application and that it isn't approved.
--
--   3. Private storage bucket `facility-docs` (the API also creates it on
--      first use, so this is belt and braces). No storage policies are
--      added: only the service role reads or writes it.
--
-- Additive and idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS facility_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES facility_applications(id) ON DELETE CASCADE,
  document_type  text NOT NULL CHECK (document_type IN (
                   'cac_certificate', 'operating_licence', 'mlscn_accreditation',
                   'pcn_premises_licence', 'moh_facility_licence', 'other')),
  file_url       text NOT NULL,
  file_name      text,
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_documents_application_id_idx ON facility_documents(application_id);

ALTER TABLE facility_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS facility_documents_admin_read ON facility_documents;
CREATE POLICY facility_documents_admin_read ON facility_documents
  FOR SELECT USING (get_user_role() = 'admin');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('facility-docs', 'facility-docs', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
ON CONFLICT (id) DO NOTHING;
