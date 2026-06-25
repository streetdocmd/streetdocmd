-- Storage bucket for provider credential documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-docs',
  'provider-docs',
  true,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated providers to upload their own documents
CREATE POLICY "providers_upload_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'provider-docs'
    AND auth.uid() IS NOT NULL
  );

-- Allow authenticated users to read documents (table-level RLS handles row access)
CREATE POLICY "providers_read_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'provider-docs'
    AND auth.uid() IS NOT NULL
  );