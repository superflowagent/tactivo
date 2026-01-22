ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_can_select_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_select_exercise_objects" ON storage.objects
  FOR SELECT USING (
    bucket = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR auth.role() = 'authenticated'
      OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "allow_auth_uploads_exercise_videos" ON storage.objects;
CREATE POLICY "allow_auth_uploads_exercise_videos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket = 'exercise_videos' AND (
      auth.role() = 'service_role'
      OR (
        (SELECT p.role FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = 'professional'
        AND (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = split_part(new.path, '/', 1)
      )
    )
  );

DROP POLICY IF EXISTS "company_can_update_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_update_exercise_objects" ON storage.objects
  FOR UPDATE USING (
    bucket = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  ) WITH CHECK (
    bucket = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR split_part(new.path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "company_can_delete_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_delete_exercise_objects" ON storage.objects
  FOR DELETE USING (
    bucket = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );
