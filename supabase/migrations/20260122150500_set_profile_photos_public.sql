-- Migration: make profile_photos bucket public for local dev (idempotent)
UPDATE storage.buckets
SET public = true
WHERE id = 'profile_photos' AND public IS NOT TRUE;

-- Also make company_logos and exercise_videos public for convenience
UPDATE storage.buckets
SET public = true
WHERE id IN ('company_logos', 'exercise_videos') AND public IS NOT TRUE;
