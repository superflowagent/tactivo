-- ARCHIVED: Replaced by 20260122143100_upsert_profiles_user_trigger.sql
-- Local helper migration: create auth.user when profile is inserted without user
BEGIN;

CREATE OR REPLACE FUNCTION public.create_auth_user_for_profile()
RETURNS trigger AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NEW."user" IS NOT NULL OR NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO auth.users (id, email, created_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), NEW.email, now(), jsonb_build_object('created_from', 'profiles_trigger'))
    RETURNING id INTO new_id;

  NEW."user" = new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_auth_user_before_insert ON public.profiles;
CREATE TRIGGER trg_create_auth_user_before_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_auth_user_for_profile();

COMMIT;
