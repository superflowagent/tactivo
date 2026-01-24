
DO $$ BEGIN
  -- Minimal idempotent stubs for core tables so later functions/policies can be created safely
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='companies') THEN
    CREATE TABLE public.companies (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name text,
      domain text
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    CREATE TABLE public.profiles (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      "user" uuid,
      company uuid,
      name text,
      last_name text,
      email text,
      role text,
      phone text,
      invite_token uuid,
      invite_expires_at timestamp without time zone
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='classes_templates') THEN
    CREATE TABLE public.classes_templates (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name text,
      company uuid
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='events') THEN
    CREATE TABLE public.events (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      company uuid,
      datetime timestamp without time zone,
      client uuid[],
      professional uuid[]
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='anatomy') THEN
    create table if not exists "public"."anatomy" (
      "id" uuid not null default gen_random_uuid(),
      "name" text,
      "created" timestamp without time zone,
      "company" uuid
    );
  END IF;
END $$;


alter table "public"."anatomy" enable row level security;


  create table if not exists "public"."equipment" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "created" timestamp without time zone,
    "company" uuid
      );


alter table "public"."equipment" enable row level security;


  create table if not exists "public"."exercises" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "file" text,
    "created" timestamp without time zone,
    "description" text,
    "company" uuid,
    "anatomy" uuid[] default '{}'::uuid[],
    "equipment" uuid[] default '{}'::uuid[]
      );


alter table "public"."exercises" enable row level security;


  create table if not exists "public"."program_exercises" (
    "id" uuid not null default gen_random_uuid(),
    "notes" text,
    "exercise" uuid,
    "reps" numeric,
    "weight" numeric,
    "sets" numeric,
    "secs" numeric,
    "program" uuid,
    "position" numeric,
    "day" text
      );


alter table "public"."program_exercises" enable row level security;


  create table if not exists "public"."programs" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "created" timestamp without time zone,
    "company" uuid,
    "profile" uuid,
    "description" text,
    "position" numeric
      );


alter table "public"."programs" enable row level security;

ALTER TABLE IF EXISTS public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='hola'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN hola text;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS anatomy_pkey ON public.anatomy USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS equipment_pkey ON public.equipment USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS exercises_aux_pkey ON public.program_exercises USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS exercises_pkey ON public.exercises USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS plans_pkey ON public.programs USING btree (id);

-- Core table primary keys so FK additions succeed on empty DBs
CREATE UNIQUE INDEX IF NOT EXISTS companies_pkey ON public.companies USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'anatomy') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anatomy_pkey') THEN
      alter table "public"."anatomy" add constraint "anatomy_pkey" PRIMARY KEY using index "anatomy_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'equipment') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_pkey') THEN
      alter table "public"."equipment" add constraint "equipment_pkey" PRIMARY KEY using index "equipment_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'exercises') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_pkey') THEN
      alter table "public"."exercises" add constraint "exercises_pkey" PRIMARY KEY using index "exercises_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'program_exercises') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_pkey') THEN
      alter table "public"."program_exercises" add constraint "exercises_aux_pkey" PRIMARY KEY using index "exercises_aux_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'programs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_pkey') THEN
      alter table "public"."programs" add constraint "plans_pkey" PRIMARY KEY using index "plans_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'companies') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_pkey') THEN
      alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
      alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'companies') THEN

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anatomy_company_fkey') THEN
      alter table "public"."anatomy" add constraint "anatomy_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anatomy_company_fkey') THEN
      alter table "public"."anatomy" validate constraint "anatomy_company_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_company_fkey') THEN
      alter table "public"."equipment" add constraint "equipment_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_company_fkey') THEN
      alter table "public"."equipment" validate constraint "equipment_company_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_company_fkey') THEN
      alter table "public"."exercises" add constraint "exercises_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_company_fkey') THEN
      alter table "public"."exercises" validate constraint "exercises_company_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_exercise_fkey') THEN
      alter table "public"."program_exercises" add constraint "exercises_aux_exercise_fkey" FOREIGN KEY (exercise) REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_exercise_fkey') THEN
      alter table "public"."program_exercises" validate constraint "exercises_aux_exercise_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_exercises_program_fkey') THEN
      alter table "public"."program_exercises" add constraint "program_exercises_program_fkey" FOREIGN KEY (program) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_exercises_program_fkey') THEN
      alter table "public"."program_exercises" validate constraint "program_exercises_program_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_company_fkey') THEN
      alter table "public"."programs" add constraint "plans_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_company_fkey') THEN
      alter table "public"."programs" validate constraint "plans_company_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_profile_fkey') THEN
      alter table "public"."programs" add constraint "plans_profile_fkey" FOREIGN KEY (profile) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_profile_fkey') THEN
      alter table "public"."programs" validate constraint "plans_profile_fkey";
    END IF;

  END IF;
END
$$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_auth_user_for_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    p record;
    uid_text text;
BEGIN
    -- Find profile by token (try uuid cast first)
    BEGIN
        SELECT * INTO p FROM public.profiles WHERE invite_token = p_token::uuid LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
        SELECT * INTO p FROM public.profiles WHERE invite_token::text = p_token LIMIT 1;
    END;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_invite_token';
    END IF;

    IF p.invite_expires_at IS NOT NULL AND p.invite_expires_at < now() THEN
        RAISE EXCEPTION 'token_expired';
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    uid_text := auth.uid();

    -- Ensure profile not already linked to another user
    IF p."user" IS NOT NULL AND p."user"::text <> uid_text THEN
        RAISE EXCEPTION 'profile_already_linked';
    END IF;

    -- Link profile to current user and clear token fields
    UPDATE public.profiles
    SET "user" = uid_text::uuid, invite_token = NULL, invite_expires_at = NULL
    WHERE id = p.id;

    RETURN (SELECT to_jsonb(profiles) FROM public.profiles WHERE id = p.id);
END;
$function$
;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    CREATE OR REPLACE FUNCTION public.accept_invite(p_token uuid)
     RETURNS SETOF public.profiles
     LANGUAGE plpgsql
     SECURITY DEFINER
    AS $function$
    DECLARE
      v_profile public.profiles%ROWTYPE;
    BEGIN
      -- Find invited profile
      SELECT * INTO v_profile FROM public.profiles WHERE invite_token = p_token LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_invite_token';
      END IF;

      -- Check expiration if provided (invite_expires_at is a timestamp)
      IF v_profile.invite_expires_at IS NOT NULL AND v_profile.invite_expires_at < now() THEN
        RAISE EXCEPTION 'invite_expired';
      END IF;

      -- Ensure the profile isn't already linked to a user
      IF v_profile."user" IS NOT NULL THEN
        RAISE EXCEPTION 'invite_already_accepted';
      END IF;

      -- Perform the update linking the current authenticated user
      UPDATE public.profiles
      SET "user" = auth.uid(), invite_token = NULL, invite_expires_at = NULL
      WHERE id = v_profile.id;

      -- Return the updated profile
      RETURN QUERY
      SELECT * FROM public.profiles WHERE id = v_profile.id;
    END;
    $function$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.accept_invite_debug(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    res jsonb;
BEGIN
    BEGIN
        -- delegate to the existing accept_invite overloads; prefer uuid if possible
        BEGIN
            res := public.accept_invite(p_token);
            RETURN jsonb_build_object('ok', true, 'result', res);
        EXCEPTION WHEN SQLSTATE '42883' THEN
            -- function not found for text: try uuid overload
            res := public.accept_invite(p_token::uuid);
            RETURN jsonb_build_object('ok', true, 'result', res);
        END;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_invite_http(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Cast incoming token to uuid and delegate to uuid overload to avoid operator mismatches
    RETURN public.accept_invite(p_token::uuid);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.accept_invite_verbose(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    p record;
    uid_text text := NULL;
    result jsonb := '{}'::jsonb;
BEGIN
    -- Attempt to find by uuid token first
    BEGIN
        SELECT * INTO p FROM public.profiles WHERE invite_token = p_token::uuid LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
        -- token is not uuid; try text match
        BEGIN
            SELECT * INTO p FROM public.profiles WHERE invite_token::text = p_token LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('ok', false, 'step', 'select', 'error', SQLERRM);
        END;
    END;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'step', 'select', 'error', 'profile_not_found');
    END IF;

    result := result || jsonb_build_object('found_profile_id', p.id);

    -- auth check
    BEGIN
        uid_text := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'auth', 'error', SQLERRM);
    END;

    IF uid_text IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'step', 'auth', 'error', 'not_authenticated');
    END IF;

    result := result || jsonb_build_object('auth_uid', uid_text);

    -- check already linked (compare as text to avoid uuid<>text operator error)
    IF p."user" IS NOT NULL AND p."user"::text <> uid_text THEN
        RETURN jsonb_build_object('ok', false, 'step', 'precheck', 'error', 'profile_already_linked', 'profile_user', p."user", 'caller', uid_text);
    END IF;

    -- Attempt update
    BEGIN
        UPDATE public.profiles
        SET "user" = uid_text::uuid, invite_token = NULL, invite_expires_at = NULL
        WHERE id = p.id;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'update', 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    result := result || jsonb_build_object('update', 'ok');

    -- Attempt to return JSONB representation
    BEGIN
        result := result || jsonb_build_object('profile', (SELECT to_jsonb(profiles) FROM public.profiles WHERE id = p.id));
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'step', 'to_jsonb', 'error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    RETURN jsonb_build_object('ok', true) || result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_class_credits_on_events_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  raw_client text := NULL;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE p.id = ANY(as_uuid_array(NEW.client)) AND p.role = 'client';

    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE id = ANY(v_ids) AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    raw_client := COALESCE(OLD.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE p.id = ANY(as_uuid_array(OLD.client)) AND p.role = 'client';

    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE id = ANY(v_ids) AND role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');

    -- Transition: non-class -> class (deduct for all NEW clients)
    IF COALESCE(OLD.type,'') <> 'class' AND COALESCE(NEW.type,'') = 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE p.id = ANY(as_uuid_array(NEW.client)) AND p.role = 'client';

      IF array_length(v_ids,1) IS NOT NULL THEN
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) - 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
      END IF;

    -- Transition: class -> non-class (refund for all OLD clients)
    ELSIF COALESCE(OLD.type,'') = 'class' AND COALESCE(NEW.type,'') <> 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE p.id = ANY(as_uuid_array(OLD.client)) AND p.role = 'client';

      IF array_length(v_ids,1) IS NOT NULL THEN
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) + 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
      END IF;

    -- Otherwise: both classes or both non-classes — keep add/remove behavior for class->class changes
    ELSE
      IF COALESCE(NEW.type,'') = 'class' OR COALESCE(OLD.type,'') = 'class' THEN
        -- Added
        WITH new_clients AS (
          SELECT unnest(as_uuid_array(NEW.client)) AS id
        ),
        old_clients AS (
          SELECT unnest(as_uuid_array(OLD.client)) AS id
        ),
        added AS (
          SELECT id FROM new_clients EXCEPT SELECT id FROM old_clients
        )
        SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM added;

        IF array_length(v_ids,1) IS NOT NULL THEN
          UPDATE public.profiles p
          SET class_credits = COALESCE(class_credits, 0) - 1
          WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
        END IF;

        -- Removed
        WITH new_clients AS (
          SELECT unnest(as_uuid_array(NEW.client)) AS id
        ),
        old_clients AS (
          SELECT unnest(as_uuid_array(OLD.client)) AS id
        ),
        removed AS (
          SELECT id FROM old_clients EXCEPT SELECT id FROM new_clients
        )
        SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM removed;

        IF array_length(v_ids,1) IS NOT NULL THEN
          UPDATE public.profiles p
          SET class_credits = COALESCE(class_credits, 0) + 1
          WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.as_uuid_array(_val anyelement)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _t text := pg_typeof(_val)::text;
  _res uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _val IS NULL THEN
    RETURN _res;
  END IF;

  IF _t = 'uuid[]' THEN
    RETURN _val;
  ELSIF _t IN ('text','varchar','character varying') THEN
    BEGIN
      _res := ARRAY[ NULLIF(_val::text,'')::uuid ];
      RETURN _res;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN ARRAY[]::uuid[];
    END;
  ELSIF right(_t, 2) = '[]' THEN
    BEGIN
      RETURN (SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) FROM unnest(_val) AS x);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN ARRAY[]::uuid[];
    END;
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dbg_accept_invite_sim(p_token uuid, p_caller uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    p record;
BEGIN
    SELECT * INTO p FROM public.profiles WHERE invite_token = p_token LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'profile_not_found');
    END IF;

    IF p.invite_expires_at IS NOT NULL AND p.invite_expires_at < now() THEN
        RETURN jsonb_build_object('error', 'token_expired');
    END IF;

    IF p.user IS NOT NULL AND p.user <> p_caller THEN
        RETURN jsonb_build_object('error', 'profile_already_linked');
    END IF;

    UPDATE public.profiles
    SET "user" = p_caller, invite_token = NULL, invite_expires_at = NULL
    WHERE id = p.id;

    RETURN (SELECT to_jsonb(profiles) FROM public.profiles WHERE id = p.id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_get_caller_info()
 RETURNS TABLE(caller_uid text, caller_company uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT auth.uid()::text AS caller_uid,
    (SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1) AS caller_company;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_list_pg_triggers_profiles()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT jsonb_agg(row_to_json(q)) FROM (
    SELECT t.tgname, p.proname as function_name, n.nspname as function_schema, t.tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.profiles'::regclass
  ) q;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_list_profiles_triggers()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT jsonb_agg(row_to_json(t)) FROM information_schema.triggers t WHERE t.event_object_table = 'profiles';
$function$
;

CREATE OR REPLACE FUNCTION public.delete_event_json(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  p_id uuid := (p_payload->>'id')::uuid;
  v_company uuid;
BEGIN
  SELECT company INTO v_company FROM public.events WHERE id = p_id LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  IF NOT public.is_professional_of_company(v_company) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  DELETE FROM public.events WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_set_program_exercise_notes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If notes is empty or NULL, attempt to copy description from exercises table
  IF (NEW.notes IS NULL OR TRIM(NEW.notes) = '') THEN
    NEW.notes := (SELECT description FROM public.exercises WHERE id = NEW.exercise LIMIT 1);
  END IF;
  RETURN NEW;
END;
$function$
;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='companies'
  ) THEN
    CREATE OR REPLACE FUNCTION public.get_company_by_id(p_company uuid)
     RETURNS SETOF public.companies
     LANGUAGE sql
     STABLE SECURITY DEFINER
    AS $function$
      SELECT c.*
      FROM public.companies c
      WHERE c.id = p_company
        AND public.is_member_of_company(c.id)
    $function$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_event_attendee_profiles(p_event uuid)
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT p.id, p."user", p.name, p.last_name, p.photo_path, p.sport, p.class_credits
  FROM public.events e
  JOIN public.profiles p ON (p.id = ANY(e.client) OR p."user" = ANY(e.client))
  WHERE e.id = p_event
    AND p.company = e.company;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_for_company(p_company uuid)
 RETURNS TABLE(id uuid, company uuid, datetime text, duration integer, type text, client uuid[], professional uuid[], notes text, cost numeric, paid boolean)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    e.id,
    e.company,
    to_char(e.datetime, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS datetime,
    e.duration,
    e.type,
    e.client,
    e.professional,
    e.notes,
    e.cost,
    e.paid
  FROM public.events e
  JOIN public.profiles p ON p."user" = auth.uid()::uuid
  WHERE e.company = p.company
  ORDER BY e.datetime ASC;
$function$
;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    CREATE OR REPLACE FUNCTION public.get_profile_by_user(p_user uuid)
     RETURNS public.profiles
     LANGUAGE plpgsql
     STABLE SECURITY DEFINER
    AS $function$
    DECLARE
      rec public.profiles%ROWTYPE;
      has_user_id boolean;
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'
      ) INTO has_user_id;

      IF has_user_id THEN
        SELECT * INTO rec FROM public.profiles WHERE "user" = p_user OR id = p_user OR user_id = p_user LIMIT 1;
      ELSE
        SELECT * INTO rec FROM public.profiles WHERE "user" = p_user OR id = p_user LIMIT 1;
      END IF;

      RETURN rec;
    END;
    $function$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_clients(p_ids uuid[])
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer, dni text, phone text, email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND company = (
      SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_clients(p_ids uuid[], p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_professionals(p_ids uuid[])
 RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE (p.user = ANY(p_ids) OR p.id = ANY(p_ids))
    AND public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids_for_professionals(p_ids uuid[], p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer, dni text, phone text, email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND role = 'professional'
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_clients(p_role text)
 RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, photo_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  WHERE p.role = p_role
    AND public.is_member_of_company(p.company);
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_clients(p_role text, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer, dni text, phone text, email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE role = p_role
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    )
  ORDER BY name;
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_professionals(p_role text)
 RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE p.role = p_role
    AND public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_by_role_for_professionals(p_role text, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, "user" uuid, name text, last_name text, photo_path text, sport text, class_credits integer, dni text, phone text, email text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE role = p_role
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    )
  ORDER BY name;
$function$
;

CREATE OR REPLACE FUNCTION public.get_profiles_for_professionals()
 RETURNS TABLE(id uuid, user_id uuid, name text, last_name text, email text, phone text, photo_path text, role text, company uuid, class_credits integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$function$
;

CREATE OR REPLACE FUNCTION public.insert_event_json(p_payload jsonb)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_type text := p_payload->>'type';
  v_duration int := NULLIF(p_payload->>'duration','')::int;
  v_cost numeric := NULLIF(p_payload->>'cost','')::numeric;
  v_paid boolean := NULLIF(p_payload->>'paid','')::boolean;
  v_notes text := p_payload->>'notes';
  v_datetime text := p_payload->>'datetime';
  v_client uuid[] := ARRAY[]::uuid[];
  v_professional uuid[] := ARRAY[]::uuid[];
  v_company uuid := NULLIF(p_payload->>'company','')::uuid;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'company is required';
  END IF;

  -- Normalize `client` payload: accept array or scalar uuid string; reject/raise for other scalar types
  IF p_payload ? 'client' THEN
    CASE jsonb_typeof(p_payload->'client')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_client
          FROM jsonb_array_elements_text(p_payload->'client') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in client array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_client := ARRAY[ NULLIF(p_payload->>'client','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in client';
        END;
      WHEN 'null' THEN
        v_client := ARRAY[]::uuid[];
      ELSE
        -- When client is a scalar of an unexpected type (e.g. boolean), reject with clear message
        RAISE EXCEPTION 'client must be an array of uuid or a uuid string';
    END CASE;

    -- Map any client entries that are actually profile.user -> profile.id
    IF array_length(v_client,1) IS NOT NULL THEN
      SELECT coalesce(array_agg(coalesce(p.id, x::uuid)), ARRAY[]::uuid[]) INTO v_client
      FROM unnest(v_client) AS x
      LEFT JOIN public.profiles p ON p.user = x::uuid;
    END IF;
  END IF;

  -- Normalize `professional` payload
  IF p_payload ? 'professional' THEN
    CASE jsonb_typeof(p_payload->'professional')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_professional
          FROM jsonb_array_elements_text(p_payload->'professional') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in professional array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_professional := ARRAY[ NULLIF(p_payload->>'professional','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in professional';
        END;
      WHEN 'null' THEN
        v_professional := ARRAY[]::uuid[];
      ELSE
        RAISE EXCEPTION 'professional must be an array of uuid or a uuid string';
    END CASE;
  END IF;

  -- Allow insert when the caller is a professional of the company
  -- or when the caller is a client creating an appointment for themself
  IF NOT (
    public.is_professional_of_company(v_company)
    OR (
      v_type = 'appointment'
      AND (
        -- auth.uid() may match an element of v_client (profile id or user id)
        (auth.uid() IS NOT NULL AND auth.uid() = ANY(v_client))
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user = auth.uid()::uuid
            AND p.company = v_company
            AND p.role = 'client'
            AND (
              p.id = ANY(v_client)
              OR p.user = ANY(v_client)
            )
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  RETURN QUERY
    INSERT INTO public.events (type, duration, cost, paid, notes, datetime, client, professional, company)
    VALUES (v_type, v_duration, v_cost, v_paid, v_notes, v_datetime::timestamptz, v_client, v_professional, v_company)
    RETURNING public.events.id AS id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member_of_company(p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.company::text = p_company::text
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_professional_of_company(p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = p_company::text
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_profile_admin_of(company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid()::uuid AND p.role = 'admin' AND p.company = company_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_profile_member_of(company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.user = auth.uid()::uuid OR p.id = auth.uid()::uuid) AND p.company = company_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_same_company(p_company uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.profiles WHERE (id = auth.uid() OR "user" = auth.uid()) AND company = p_company);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unlink_deleted_anatomy_from_exercises()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove the deleted anatomy id from any exercise arrays
  UPDATE public.exercises ex
  SET anatomy = array_remove(ex.anatomy, OLD.id)
  WHERE OLD.id = ANY (ex.anatomy);
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unlink_deleted_equipment_from_exercises()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove the deleted equipment id from any exercise arrays
  UPDATE public.exercises ex
  SET equipment = array_remove(ex.equipment, OLD.id)
  WHERE OLD.id = ANY (ex.equipment);
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_event_json(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id uuid := NULLIF(p_payload->>'id','')::uuid;
  v_changes jsonb := COALESCE(p_payload->'changes', '{}'::jsonb);
  v_type text := v_changes->>'type';
  v_duration int := NULLIF(v_changes->>'duration','')::int;
  v_cost numeric := NULLIF(v_changes->>'cost','')::numeric;
  v_paid boolean := NULLIF(v_changes->>'paid','')::boolean;
  v_notes text := v_changes->>'notes';
  v_datetime text := v_changes->>'datetime';
  v_client uuid[] := NULL;
  v_professional uuid[] := NULL;
  v_event_company uuid := NULL;
  v_event_type text := NULL;
  v_event_client uuid[] := ARRAY[]::uuid[];
  v_new_clients uuid[] := ARRAY[]::uuid[];
  v_my_profile_id uuid := NULL;
  v_my_user_id uuid := NULL;
  v_auth_uid_text text := NULL;
  v_added uuid[] := ARRAY[]::uuid[];
  v_removed uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'id is required';
  END IF;

  -- Normalize `client` payload: accept array or scalar uuid string
  IF v_changes ? 'client' THEN
    CASE jsonb_typeof(v_changes->'client')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_client
          FROM jsonb_array_elements_text(v_changes->'client') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in client array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_client := ARRAY[ NULLIF(v_changes->>'client','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in client';
        END;
      WHEN 'null' THEN
        v_client := ARRAY[]::uuid[];
      ELSE
        RAISE EXCEPTION 'client must be an array of uuid or a uuid string';
    END CASE;

    -- Map any client entries that are actually profile.user -> profile.id
    IF array_length(v_client,1) IS NOT NULL THEN
      SELECT coalesce(array_agg(coalesce(p.id, x::uuid)), ARRAY[]::uuid[]) INTO v_client
      FROM unnest(v_client) AS x
      LEFT JOIN public.profiles p ON p.user = x::uuid;
    END IF;
  END IF;

  -- Normalize `professional` payload
  IF v_changes ? 'professional' THEN
    CASE jsonb_typeof(v_changes->'professional')
      WHEN 'array' THEN
        BEGIN
          SELECT coalesce(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_professional
          FROM jsonb_array_elements_text(v_changes->'professional') AS x;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in professional array';
        END;
      WHEN 'string' THEN
        BEGIN
          v_professional := ARRAY[ NULLIF(v_changes->>'professional','')::uuid ];
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'invalid uuid value in professional';
        END;
      WHEN 'null' THEN
        v_professional := ARRAY[]::uuid[];
      ELSE
        RAISE EXCEPTION 'professional must be an array of uuid or a uuid string';
    END CASE;
  END IF;

  -- Load event details (company, type and current client list)
  SELECT company, type, client::text INTO v_event_company, v_event_type, v_event_client
  FROM public.events WHERE id = v_id;
  IF v_event_company IS NULL THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  -- Normalize whatever was stored in events.client into a uuid[] safely
  v_event_client := public.as_uuid_array(v_event_client);

  -- Permission checks
  v_auth_uid_text := auth.uid();
  IF v_auth_uid_text IS NOT NULL AND v_auth_uid_text <> '' THEN
    v_my_user_id := v_auth_uid_text::uuid;
  ELSE
    v_my_user_id := NULL;
  END IF;

  IF v_my_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = v_my_user_id
      AND p.company = v_event_company
      AND (p.role = 'professional' OR p.role = 'admin')
  ) THEN
    -- allowed
  ELSE
    IF NOT (v_changes ? 'client' AND (v_changes - 'client') = '{}'::jsonb) THEN
      RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT id INTO v_my_profile_id FROM public.profiles p WHERE p.user = v_my_user_id AND p.company = v_event_company LIMIT 1;
    v_new_clients := COALESCE(v_client, ARRAY[]::uuid[]);

    SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO v_added
    FROM unnest(v_new_clients) AS x
    WHERE NOT x = ANY(v_event_client);

    SELECT coalesce(array_agg(x), ARRAY[]::uuid[]) INTO v_removed
    FROM unnest(v_event_client) AS x
    WHERE NOT x = ANY(v_new_clients);

    IF v_event_type <> 'class' THEN
      RAISE EXCEPTION 'permission denied';
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(coalesce(v_added, ARRAY[]::uuid[]) || coalesce(v_removed, ARRAY[]::uuid[])) AS u(x)
      WHERE NOT (
        (v_my_user_id IS NOT NULL AND x = v_my_user_id)
        OR (v_my_profile_id IS NOT NULL AND x = v_my_profile_id)
      )
    ) THEN
      RAISE EXCEPTION 'permission denied';
    END IF;
  END IF;

  -- Perform the update
  UPDATE public.events
  SET
    type = CASE WHEN v_changes ? 'type' THEN v_type ELSE type END,
    duration = CASE WHEN v_changes ? 'duration' THEN v_duration ELSE duration END,
    cost = CASE WHEN v_changes ? 'cost' THEN v_cost ELSE cost END,
    paid = CASE WHEN v_changes ? 'paid' THEN v_paid ELSE paid END,
    notes = CASE WHEN v_changes ? 'notes' THEN v_notes ELSE notes END,
    datetime = CASE WHEN v_changes ? 'datetime' AND NULLIF(v_datetime,'') IS NOT NULL THEN v_datetime::timestamptz ELSE datetime END,
    client = CASE WHEN v_changes ? 'client' THEN COALESCE(v_client, ARRAY[]::uuid[]) ELSE client END,
    professional = CASE WHEN v_changes ? 'professional' THEN COALESCE(v_professional, ARRAY[]::uuid[]) ELSE professional END
  WHERE id = v_id;
END;
$function$
;

grant delete on table "public"."anatomy" to "anon";

grant insert on table "public"."anatomy" to "anon";

grant references on table "public"."anatomy" to "anon";

grant select on table "public"."anatomy" to "anon";

grant trigger on table "public"."anatomy" to "anon";

grant truncate on table "public"."anatomy" to "anon";

grant update on table "public"."anatomy" to "anon";

grant delete on table "public"."anatomy" to "authenticated";

grant insert on table "public"."anatomy" to "authenticated";

grant references on table "public"."anatomy" to "authenticated";

grant select on table "public"."anatomy" to "authenticated";

grant trigger on table "public"."anatomy" to "authenticated";

grant truncate on table "public"."anatomy" to "authenticated";

grant update on table "public"."anatomy" to "authenticated";

grant delete on table "public"."anatomy" to "service_role";

grant insert on table "public"."anatomy" to "service_role";

grant references on table "public"."anatomy" to "service_role";

grant select on table "public"."anatomy" to "service_role";

grant trigger on table "public"."anatomy" to "service_role";

grant truncate on table "public"."anatomy" to "service_role";

grant update on table "public"."anatomy" to "service_role";

grant delete on table "public"."equipment" to "anon";

grant insert on table "public"."equipment" to "anon";

grant references on table "public"."equipment" to "anon";

grant select on table "public"."equipment" to "anon";

grant trigger on table "public"."equipment" to "anon";

grant truncate on table "public"."equipment" to "anon";

grant update on table "public"."equipment" to "anon";

grant delete on table "public"."equipment" to "authenticated";

grant insert on table "public"."equipment" to "authenticated";

grant references on table "public"."equipment" to "authenticated";

grant select on table "public"."equipment" to "authenticated";

grant trigger on table "public"."equipment" to "authenticated";

grant truncate on table "public"."equipment" to "authenticated";

grant update on table "public"."equipment" to "authenticated";

grant delete on table "public"."equipment" to "service_role";

grant insert on table "public"."equipment" to "service_role";

grant references on table "public"."equipment" to "service_role";

grant select on table "public"."equipment" to "service_role";

grant trigger on table "public"."equipment" to "service_role";

grant truncate on table "public"."equipment" to "service_role";

grant update on table "public"."equipment" to "service_role";

grant delete on table "public"."exercises" to "anon";

grant insert on table "public"."exercises" to "anon";

grant references on table "public"."exercises" to "anon";

grant select on table "public"."exercises" to "anon";

grant trigger on table "public"."exercises" to "anon";

grant truncate on table "public"."exercises" to "anon";

grant update on table "public"."exercises" to "anon";

grant delete on table "public"."exercises" to "authenticated";

grant insert on table "public"."exercises" to "authenticated";

grant references on table "public"."exercises" to "authenticated";

grant select on table "public"."exercises" to "authenticated";

grant trigger on table "public"."exercises" to "authenticated";

grant truncate on table "public"."exercises" to "authenticated";

grant update on table "public"."exercises" to "authenticated";

grant delete on table "public"."exercises" to "service_role";

grant insert on table "public"."exercises" to "service_role";

grant references on table "public"."exercises" to "service_role";

grant select on table "public"."exercises" to "service_role";

grant trigger on table "public"."exercises" to "service_role";

grant truncate on table "public"."exercises" to "service_role";

grant update on table "public"."exercises" to "service_role";

grant delete on table "public"."program_exercises" to "anon";

grant insert on table "public"."program_exercises" to "anon";

grant references on table "public"."program_exercises" to "anon";

grant select on table "public"."program_exercises" to "anon";

grant trigger on table "public"."program_exercises" to "anon";

grant truncate on table "public"."program_exercises" to "anon";

grant update on table "public"."program_exercises" to "anon";

grant delete on table "public"."program_exercises" to "authenticated";

grant insert on table "public"."program_exercises" to "authenticated";

grant references on table "public"."program_exercises" to "authenticated";

grant select on table "public"."program_exercises" to "authenticated";

grant trigger on table "public"."program_exercises" to "authenticated";

grant truncate on table "public"."program_exercises" to "authenticated";

grant update on table "public"."program_exercises" to "authenticated";

grant delete on table "public"."program_exercises" to "service_role";

grant insert on table "public"."program_exercises" to "service_role";

grant references on table "public"."program_exercises" to "service_role";

grant select on table "public"."program_exercises" to "service_role";

grant trigger on table "public"."program_exercises" to "service_role";

grant truncate on table "public"."program_exercises" to "service_role";

grant update on table "public"."program_exercises" to "service_role";

grant delete on table "public"."programs" to "anon";

grant insert on table "public"."programs" to "anon";

grant references on table "public"."programs" to "anon";

grant select on table "public"."programs" to "anon";

grant trigger on table "public"."programs" to "anon";

grant truncate on table "public"."programs" to "anon";

grant update on table "public"."programs" to "anon";

grant delete on table "public"."programs" to "authenticated";

grant insert on table "public"."programs" to "authenticated";

grant references on table "public"."programs" to "authenticated";

grant select on table "public"."programs" to "authenticated";

grant trigger on table "public"."programs" to "authenticated";

grant truncate on table "public"."programs" to "authenticated";

grant update on table "public"."programs" to "authenticated";

grant delete on table "public"."programs" to "service_role";

grant insert on table "public"."programs" to "service_role";

grant references on table "public"."programs" to "service_role";

grant select on table "public"."programs" to "service_role";

grant trigger on table "public"."programs" to "service_role";

grant truncate on table "public"."programs" to "service_role";

grant update on table "public"."programs" to "service_role";












  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'anatomy') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can update"
  on "public"."anatomy"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))))
with check ((company = ( SELECT p.company
   FROM public.profiles p
  WHERE (p."user" = auth.uid())
 LIMIT 1)));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'anatomy_select_company' AND n.nspname = 'public' AND c.relname = 'anatomy') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "anatomy_select_company"
  on "public"."anatomy"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()::uuid) AND (p.company = anatomy.company)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'anatomy_write_company' AND n.nspname = 'public' AND c.relname = 'anatomy') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "anatomy_write_company"
  on "public"."anatomy"
  as permissive
  for all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text) AND (p.company = anatomy.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can delete"
  on "public"."equipment"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can insert"
  on "public"."equipment"
  as permissive
  for insert
  to public
with check ((company = ( SELECT p.company
   FROM public.profiles p
  WHERE (p."user" = auth.uid())
 LIMIT 1)));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can select"
  on "public"."equipment"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can update"
  on "public"."equipment"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))))
with check ((company = ( SELECT p.company
   FROM public.profiles p
  WHERE (p."user" = auth.uid())
 LIMIT 1)));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'equipment_select_company' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE $policy$CREATE POLICY "equipment_select_company" ON public.equipment AS permissive FOR SELECT TO public USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.company = equipment.company))));$policy$;
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'equipment_write_company' AND n.nspname = 'public' AND c.relname = 'equipment') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE $policy$CREATE POLICY "equipment_write_company" ON public.equipment AS permissive FOR ALL TO public USING ((auth.role() = 'service_role'::text) OR (EXISTS (SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text) AND (p.company = equipment.company))))) WITH CHECK ((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text)))));$policy$;
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE $policy$CREATE POLICY "Company members can delete" ON public.exercises AS permissive FOR DELETE TO public USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p."user" = auth.uid()::uuid) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text)))));$policy$;
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can insert"
  on "public"."exercises"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can select"
  on "public"."exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can update"
  on "public"."exercises"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'company_resource_select' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    EXECUTE $policy$CREATE POLICY "company_resource_select" ON public.exercises AS permissive FOR SELECT TO public USING (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()::uuid) AND (p.company = exercises.company))));$policy$;
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'company_resource_write' AND n.nspname = 'public' AND c.relname = 'exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "company_resource_write"
  on "public"."exercises"
  as permissive
  for all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()::uuid) AND (p.role = 'professional'::text) AND (p.company = exercises.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'program_exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can delete"
  on "public"."program_exercises"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'program_exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can insert"
  on "public"."program_exercises"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'program_exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can select"
  on "public"."program_exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'program_exercises') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can update"
  on "public"."program_exercises"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
with check ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'programs') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can delete"
  on "public"."programs"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'programs') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can insert"
  on "public"."programs"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'programs') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can select"
  on "public"."programs"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company)))));
  END IF;
END
$$;



  DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'programs') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    create policy "Company members can update"
  on "public"."programs"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;


DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_unlink_anatomy_from_exercises') THEN
    CREATE TRIGGER trg_unlink_anatomy_from_exercises AFTER DELETE ON public.anatomy FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_anatomy_from_exercises();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_unlink_equipment_from_exercises') THEN
    CREATE TRIGGER trg_unlink_equipment_from_exercises AFTER DELETE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.unlink_deleted_equipment_from_exercises();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_create_auth_user_before_insert') THEN
    CREATE TRIGGER trg_create_auth_user_before_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_auth_user_for_profile();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_program_exercise_notes') THEN
    CREATE TRIGGER trg_set_program_exercise_notes BEFORE INSERT ON public.program_exercises FOR EACH ROW EXECUTE FUNCTION public.fn_set_program_exercise_notes();
  END IF;
END $$;


