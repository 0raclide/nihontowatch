-- Create user-images storage bucket for collection item images.
-- Public read (images may appear in public listings after promote).
-- Write/delete scoped to owner via path prefix = auth.uid().

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-images', 'user-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (public bucket)
CREATE POLICY "user_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-images');

-- Authenticated users can upload to their own prefix
CREATE POLICY "user_images_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own files
CREATE POLICY "user_images_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own files
CREATE POLICY "user_images_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
