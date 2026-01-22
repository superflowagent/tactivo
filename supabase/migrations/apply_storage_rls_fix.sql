-- Adjusted storage RLS policies to match local storage.objects schema (bucket_id, name, path_tokens)
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_can_select_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_select_exercise_objects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR auth.role() = 'authenticated'
      OR coalesce(split_part(name, '/', 1), path_tokens[1])::uuid = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "allow_auth_uploads_exercise_videos" ON storage.objects;
CREATE POLICY "allow_auth_uploads_exercise_videos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exercise_videos' AND (
      auth.role() = 'service_role'
      OR (
        (SELECT p.role FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = 'professional'
        AND coalesce(split_part(name, '/', 1), path_tokens[1])::uuid = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
      )
    )
  );

DROP POLICY IF EXISTS "company_can_update_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_update_exercise_objects" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR coalesce(split_part(name, '/', 1), path_tokens[1])::uuid = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  ) WITH CHECK (
    bucket_id = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR coalesce(split_part(name, '/', 1), path_tokens[1])::uuid = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "company_can_delete_exercise_objects" ON storage.objects;
CREATE POLICY "company_can_delete_exercise_objects" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exercise_videos'
    AND (
      auth.role() = 'service_role'
      OR coalesce(split_part(name, '/', 1), path_tokens[1])::uuid = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
    )
  );
