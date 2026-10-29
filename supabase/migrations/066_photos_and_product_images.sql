-- ============================================================
-- Migration 066: profile photos, facility logos and product images
--
-- Everyone can add a profile photo (users.photo_url and providers.photo_url
-- already exist), facilities can add a logo, and pharmacies can add a
-- picture to each product.
--
--   pharmacy_partners / lab_partners / hospital_partners .logo_url
--   drug_catalogue.image_url
--   storage bucket "avatars"         profile photos and facility logos
--   storage bucket "product-images"  pharmacy product pictures
--
-- Both buckets are public to read (the pictures are shown to patients and
-- providers). Uploads go through server routes that check who owns the
-- record, resize the image and write with the service role, so there are
-- no client write policies on storage.objects for these buckets.
-- ============================================================

ALTER TABLE pharmacy_partners ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE lab_partners ADD COLUMN IF NOT EXISTS logo_url text;
DO $$
BEGIN
  IF to_regclass('public.hospital_partners') IS NOT NULL THEN
    ALTER TABLE hospital_partners ADD COLUMN IF NOT EXISTS logo_url text;
  END IF;
END $$;

ALTER TABLE drug_catalogue ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
