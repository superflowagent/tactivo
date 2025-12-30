-- Migration: create minimal auth.users for profiles and clear user metadata
-- Date: 2025-12-30

BEGIN;

-- 0) Create backups
CREATE TABLE IF NOT EXISTS auth.users_backup AS SELECT * FROM auth.users;
CREATE TABLE IF NOT EXISTS public.profiles_backup AS SELECT * FROM public.profiles;

-- 1) Insert a new auth.user for each profile that does not have one yet.
--    Emails are synthetic and include the profile id so we can map them back safely.
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, created_at, raw_app_meta_data, raw_user_meta_data)
SELECT gen_random_uuid() AS id,
       ('no-reply+' || p.id::text || '@seed.local')::text AS email,
       'authenticated' AS aud,
       COALESCE(p.role, 'user') AS role,
       now() AS email_confirmed_at,
       now() AS created_at,
       '{}'::jsonb AS raw_app_meta_data,
       '{}'::jsonb AS raw_user_meta_data
FROM public.profiles p
WHERE p."user" IS NULL;

-- 2) Link profiles to the newly created users (matching by the synthetic email)
UPDATE public.profiles p
SET "user" = u.id
FROM auth.users u
WHERE p."user" IS NULL
  AND u.email = ('no-reply+' || p.id::text || '@seed.local');

-- 3) Ensure user.role matches profile.role for linked users
UPDATE auth.users u
SET role = p.role
FROM public.profiles p
WHERE p."user" = u.id
  AND u.role IS DISTINCT FROM p.role;

-- 4) Wipe metadata in auth.users (keep columns but clear the content)
UPDATE auth.users
SET raw_app_meta_data = '{}'::jsonb,
    raw_user_meta_data = '{}'::jsonb;

-- 5) (Optional) If you want to drop the metadata columns entirely, uncomment below
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS raw_app_meta_data;
-- ALTER TABLE auth.users DROP COLUMN IF EXISTS raw_user_meta_data;

COMMIT;

-- Verification queries:
-- SELECT count(*) FROM auth.users_backup;
-- SELECT p.id, p.name, p.role, p."user" FROM public.profiles p WHERE p."user" IS NOT NULL LIMIT 20;
-- SELECT u.id, u.email, u.role FROM auth.users u WHERE u.email LIKE 'no-reply+%';
