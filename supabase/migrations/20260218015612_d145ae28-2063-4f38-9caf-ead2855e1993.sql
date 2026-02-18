
-- Fix campaign-media bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update campaign media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete campaign media" ON storage.objects;

CREATE POLICY "Company owners can upload campaign media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-media' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update campaign media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'campaign-media' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can delete campaign media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'campaign-media' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );

-- Fix logos bucket policies
DROP POLICY IF EXISTS "Users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete logos" ON storage.objects;

CREATE POLICY "Company owners can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies WHERE owner_user_id = auth.uid()
    )
  );
