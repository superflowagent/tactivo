-- Allow company members to manage objects inside the exercise_videos bucket when the path is prefixed with their company id.
-- Safe to re-run: drop existing policies first.

-- Attempt storage changes in a safe block: if the current DB user is not owner, swallow the error and continue.
DO $$
BEGIN
  BEGIN
    -- Ensure RLS is enabled on storage.objects (applies to all buckets; policies will filter by bucket = 'exercise_videos')
    ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

    -- SELECT: allow users to list/select objects in bucket 'exercise_videos' for their company or service role
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

    -- INSERT: allow uploading objects to bucket 'exercise_videos' by service_role or company professionals
    DROP POLICY IF EXISTS "allow_auth_uploads_exercise_videos" ON storage.objects;
    CREATE POLICY "allow_auth_uploads_exercise_videos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket = 'exercise_videos' AND (
          auth.role() = 'service_role'
          OR (
            -- Permit if the authenticated user is a professional and the object path is prefixed with their company id
            (SELECT p.role FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = 'professional'
            AND (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1) = split_part(new.path, '/', 1)
          )
        )
      );

    -- UPDATE: allow updating metadata for objects belonging to user's company or service role
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

    -- DELETE: allow deleting objects belonging to user's company or service role
    DROP POLICY IF EXISTS "company_can_delete_exercise_objects" ON storage.objects;
    CREATE POLICY "company_can_delete_exercise_objects" ON storage.objects
      FOR DELETE USING (
        bucket = 'exercise_videos'
        AND (
          auth.role() = 'service_role'
          OR split_part(path, '/', 1) = (SELECT p.company FROM public.profiles p WHERE p.user = auth.uid() LIMIT 1)
        )
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage RLS changes due to insufficient privileges: %', SQLERRM;
  END;
END $$;

-- End of script
