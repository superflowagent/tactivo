BEGIN;

-- 20260122143200_backfill_profiles_user.sql
-- Idempotent backfill: ensure profiles referencing a non-UUID 'user' or NULL 'user'
-- are linked to an existing auth.users row (by email) or have a new auth.user created.
-- This script is safe to run multiple times.

DO $$
DECLARE
  r record;
  existing_id uuid;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT id, email
    FROM public.profiles
    WHERE email IS NOT NULL
      AND (user IS NULL OR user::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  LOOP
    -- If an auth user with the same email exists, reuse it
    SELECT id INTO existing_id FROM auth.users WHERE email = r.email LIMIT 1;
    IF existing_id IS NOT NULL THEN
      UPDATE public.profiles SET "user" = existing_id WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Otherwise try to create and link, handling unique constraint on email
    BEGIN
      INSERT INTO auth.users (id, email, created_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), r.email, now(), jsonb_build_object('created_from','backfill_profiles_user'))
      RETURNING id INTO new_id;
      UPDATE public.profiles SET "user" = new_id WHERE id = r.id;
    EXCEPTION WHEN unique_violation THEN
      -- Another transaction inserted user concurrently; reuse it
      SELECT id INTO new_id FROM auth.users WHERE email = r.email LIMIT 1;
      IF new_id IS NOT NULL THEN
        UPDATE public.profiles SET "user" = new_id WHERE id = r.id;
      END IF;
    END;
  END LOOP;
END;
$$;

COMMIT;
