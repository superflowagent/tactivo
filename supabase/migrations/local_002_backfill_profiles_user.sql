-- ARCHIVED: Replaced by 20260122143200_backfill_profiles_user.sql
DO $$
DECLARE
  r record;
  new_id uuid;
  existing_id uuid;
BEGIN
  FOR r IN
    SELECT id,email
    FROM public.profiles
    WHERE user::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND email IS NOT NULL
  LOOP
    SELECT id INTO existing_id FROM auth.users WHERE email = r.email LIMIT 1;
    IF existing_id IS NOT NULL THEN
      new_id := existing_id;
    ELSE
      INSERT INTO auth.users (id,email,created_at,raw_user_meta_data)
      VALUES (gen_random_uuid(), r.email, now(), jsonb_build_object('created_from','backfill_profiles_user'))
      RETURNING id INTO new_id;
    END IF;

    UPDATE public.profiles SET "user" = new_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- Verify results
SELECT id,email,user::text FROM public.profiles WHERE email LIKE '%@%';
