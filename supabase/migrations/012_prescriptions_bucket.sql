-- Storage bucket for prescription PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prescriptions', 'prescriptions', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Patients can read their own prescription files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'patients_read_prescriptions'
  ) THEN
    CREATE POLICY "patients_read_prescriptions" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'prescriptions'
        AND EXISTS (
          SELECT 1 FROM prescriptions p
          WHERE p.pdf_url LIKE '%' || name
            AND p.patient_id = auth.uid()
        )
      );
  END IF;
END $$;
