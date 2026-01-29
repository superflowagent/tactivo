-- 2026-01-29: Relax RLS for exercise_videos to allow simpler client uploads
--
-- Rationale: in production we observed that authenticated users (professionals)
-- were blocked from uploading exercise videos due to strict storage RLS checks.
-- To reduce friction and avoid requiring Edge Functions for basic uploads, this
-- migration relaxes the INSERT policy for the `exercise_videos` bucket to allow
-- any authenticated user to insert objects. Update/Delete/Update policies keep
-- company/owner checks to avoid accidental deletion/modification by unrelated users.

-- Allow authenticated users to upload to exercise_videos (simpler check)
DROP POLICY IF EXISTS allow_authenticated_uploads_exercise_videos ON storage.objects;
CREATE POLICY allow_authenticated_uploads_exercise_videos
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    (auth.role() = 'service_role'::text)
    OR (bucket_id = 'exercise_videos' AND auth.role() = 'authenticated'::text)
  );

-- Ensure updates are allowed to the object's owner or company members
DROP POLICY IF EXISTS allow_update_exercise_videos_by_owner_or_company ON storage.objects;
CREATE POLICY allow_update_exercise_videos_by_owner_or_company
  ON storage.objects
  FOR UPDATE
  USING (
    (auth.role() = 'service_role'::text)
    OR (
      bucket_id = 'exercise_videos'
      AND (
        owner = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE ((p.user = auth.uid()::uuid) OR (p.id = auth.uid()::uuid))
            AND p.company = split_part(name, '/', 1)::uuid
        )
      )
    )
  )
  WITH CHECK (
    (auth.role() = 'service_role'::text)
    OR (
      bucket_id = 'exercise_videos'
      AND (
        owner = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE ((p.user = auth.uid()::uuid) OR (p.id = auth.uid()::uuid))
            AND p.company = split_part(name, '/', 1)::uuid
        )
      )
    )
  );

-- Ensure deletes are allowed to the object's owner or company members
DROP POLICY IF EXISTS allow_delete_exercise_videos_by_owner_or_company ON storage.objects;
CREATE POLICY allow_delete_exercise_videos_by_owner_or_company
  ON storage.objects
  FOR DELETE
  USING (
    (auth.role() = 'service_role'::text)
    OR (
      bucket_id = 'exercise_videos'
      AND (
        owner = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE ((p.user = auth.uid()::uuid) OR (p.id = auth.uid()::uuid))
            AND p.company = split_part(name, '/', 1)::uuid
        )
      )
    )
  );

-- NOTE: This change intentionally relaxes INSERT rules to prioritize developer
-- ergonomics. If you later decide you want stricter guarantees (e.g., ensure
-- the first path segment matches the caller's company for INSERT), replace the
-- INSERT policy with a check that validates split_part(name, '/', 1)::uuid = p.company
-- as in previous iterations.
