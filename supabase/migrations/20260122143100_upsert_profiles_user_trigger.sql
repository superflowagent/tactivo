BEGIN;

-- 20260122143100_upsert_profiles_user_trigger.sql
-- Robust trigger to ensure a newly-inserted profile without a linked auth user
-- either reuses an existing auth.users row with the same email, or creates one
-- safely handling concurrent inserts (unique_violation recovery).

CREATE OR REPLACE FUNCTION public.create_auth_user_for_profile()
RETURNS trigger AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- If profile already linked or has no email, nothing to do
  IF NEW."user" IS NOT NULL OR NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- If an auth user with the same email already exists, reuse it
  SELECT id INTO existing_id FROM auth.users WHERE email = NEW.email LIMIT 1;
  IF existing_id IS NOT NULL THEN
    NEW."user" = existing_id;
    RETURN NEW;
  END IF;

  -- Otherwise try to create a new auth.user, but handle race conditions where
  -- another transaction may create the same email concurrently (unique_violation)
  BEGIN
    INSERT INTO auth.users (id, email, created_at, raw_user_meta_data)
      VALUES (gen_random_uuid(), NEW.email, now(), jsonb_build_object('created_from', 'profiles_trigger'))
      RETURNING id INTO new_id;
    NEW."user" = new_id;
    RETURN NEW;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent insert inserted the user; fetch the id and reuse
    SELECT id INTO new_id FROM auth.users WHERE email = NEW.email LIMIT 1;
    IF new_id IS NOT NULL THEN
      NEW."user" = new_id;
      RETURN NEW;
    END IF;
    -- If we still didn't find it, rethrow so caller sees an error
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_auth_user_before_insert ON public.profiles;
CREATE TRIGGER trg_create_auth_user_before_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_auth_user_for_profile();

COMMIT;
