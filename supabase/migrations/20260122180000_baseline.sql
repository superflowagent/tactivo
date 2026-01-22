-- Baseline migration generated on 2026-01-22
-- Exact snapshot of local Supabase schema with manual fixes:
--  - DROP TABLE IF EXISTS public.app_settings CASCADE;
--  - ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;
-- Apply this single migration to bring remote schema to the local state.

BEGIN;

-- Ensure any legacy app_settings table is removed (was present in prod before)
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Remove legacy debug/test column from profiles if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;
  END IF;
END $$;

COMMIT;

-- The rest of the schema is the canonical snapshot (from 20260121222426_remote_schema.sql)

-- START OF SCHEMA SNAPSHOT
-- Baseline migration generated on 2026-01-22
-- Exact snapshot of local Supabase schema (from 20260121222426_remote_schema.sql)
-- Apply this single migration to provision a DB to the current state.

-- Begin schema snapshot
drop extension if exists "pg_net";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can delete" ON public.exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can insert" ON public.exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can update" ON public.exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can delete" ON public.program_exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can insert" ON public.program_exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can select" ON public.program_exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_exercises'
  ) THEN
    DROP POLICY IF EXISTS "Company members can update" ON public.program_exercises;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    DROP POLICY IF EXISTS "Company members can insert" ON public.programs;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    DROP POLICY IF EXISTS "Company members can update" ON public.programs;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_exercises'
  ) THEN
    ALTER TABLE public.program_exercises DROP CONSTRAINT IF EXISTS "program_exercises_exercise_fkey";
    ALTER TABLE public.program_exercises DROP CONSTRAINT IF EXISTS "program_exercises_program_fkey";
    ALTER TABLE public.program_exercises DROP CONSTRAINT IF EXISTS "program_exercises_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS "programs_pkey";
  END IF;
END $$;

drop index if exists "public"."program_exercises_pkey";

drop index if exists "public"."programs_pkey";


  create table if not exists "public"."classes_templates" (
    "id" uuid not null default gen_random_uuid(),
    "type" text default 'class'::text,
    "created" timestamp without time zone,
    "duration" numeric,
    "cost" numeric default '0'::numeric,
    "paid" boolean default false,
    "notes" text,
    "company" uuid,
    "client" uuid[] default '{}'::uuid[],
    "professional" uuid[] default '{}'::uuid[],
    "time" time without time zone,
    "day" numeric
      );


alter table "public"."classes_templates" enable row level security;


  create table if not exists "public"."companies" (
    "id" uuid not null default gen_random_uuid(),
    "name" text,
    "max_class_assistants" numeric default '5'::numeric,
    "class_block_mins" numeric default '720'::numeric,
    "class_unenroll_mins" numeric default '120'::numeric,
    "logo_path" text default ''::text,
    "open_time" time without time zone default '07:00:00'::time without time zone,
    "close_time" time without time zone default '19:00:00'::time without time zone,
    "default_appointment_duration" numeric default '60'::numeric,
    "default_class_duration" numeric default '90'::numeric,
    "domain" text,
    "created" timestamp without time zone default now()
      );


alter table "public"."companies" enable row level security;


  create table if not exists "public"."events" (
    "id" uuid not null default gen_random_uuid(),
    "type" text,
    "datetime" timestamp with time zone,
    "created" timestamp without time zone,
    "duration" numeric,
    "cost" numeric,
    "paid" boolean,
    "notes" text,
    "company" uuid,
    "client" uuid[] default '{}'::uuid[],
    "professional" uuid[] default '{}'::uuid[]
      );


alter table "public"."events" enable row level security;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name = 'anatomy'
  ) THEN
    ALTER TABLE public.anatomy
      ADD COLUMN IF NOT EXISTS company uuid;
    ALTER TABLE public.anatomy
      ADD COLUMN IF NOT EXISTS created timestamp without time zone;
    ALTER TABLE public.anatomy
      ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

alter table "public"."equipment" add column if not exists "company" uuid;

alter table "public"."equipment" add column if not exists "created" timestamp without time zone;

alter table "public"."equipment" enable row level security; 

alter table "public"."exercises" drop column if exists "created_at";

alter table "public"."exercises" add column if not exists "created" timestamp without time zone;

alter table "public"."exercises" add column if not exists "description" text;

alter table "public"."exercises" add column if not exists "file" text;

alter table "public"."exercises" add column if not exists "name" text;

alter table "public"."exercises" alter column "anatomy" set default '{}'::uuid[]; 

alter table "public"."exercises" alter column "equipment" set default '{}'::uuid[];

alter table "public"."profiles" drop column if exists "created_at";

alter table "public"."profiles" add column if not exists "address" text;

alter table "public"."profiles" add column if not exists "allergies" text;

alter table "public"."profiles" add column if not exists "birth_date" timestamp without time zone;

alter table "public"."profiles" add column if not exists "class_credits" numeric;

alter table "public"."profiles" add column if not exists "created" timestamp without time zone;

alter table "public"."profiles" add column if not exists "diagnosis" text;

alter table "public"."profiles" add column if not exists "dni" text;

alter table "public"."profiles" add column if not exists "email" text;

alter table "public"."profiles" add column if not exists "history" text;

alter table "public"."profiles" add column if not exists "invite_expires_at" timestamp without time zone;

alter table "public"."profiles" add column if not exists "invite_token" uuid;

alter table "public"."profiles" add column if not exists "last_name" text;

alter table "public"."profiles" add column if not exists "name" text;

alter table "public"."profiles" add column if not exists "notes" text;

alter table "public"."profiles" add column if not exists "occupation" text;

alter table "public"."profiles" add column if not exists "phone" text;

alter table "public"."profiles" add column if not exists "photo_path" text;

alter table "public"."profiles" add column if not exists "session_credits" numeric;

alter table "public"."profiles" add column if not exists "sport" text;

alter table "public"."profiles" enable row level security; 

alter table "public"."program_exercises" drop column if exists "company";

alter table "public"."program_exercises" drop column if exists "created_at";

alter table "public"."program_exercises" add column if not exists "day" text;

alter table "public"."program_exercises" add column if not exists "reps" numeric;

alter table "public"."program_exercises" add column if not exists "secs" numeric;

alter table "public"."program_exercises" add column if not exists "sets" numeric;

alter table "public"."program_exercises" add column if not exists "weight" numeric;

alter table "public"."program_exercises" alter column "exercise" drop not null; 

alter table "public"."program_exercises" alter column "position" drop default;

alter table "public"."program_exercises" alter column "position" set data type numeric using "position"::numeric;

alter table "public"."program_exercises" alter column "program" drop not null;

alter table "public"."programs" drop column if exists "created_at";

alter table "public"."programs" add column if not exists "created" timestamp without time zone;

alter table "public"."programs" add column if not exists "description" text;

alter table "public"."programs" add column if not exists "name" text;

alter table "public"."programs" add column if not exists "position" numeric;

alter table "public"."programs" add column if not exists "profile" uuid; 

CREATE INDEX IF NOT EXISTS classes_templates_company_idx ON public.classes_templates USING btree (company);

CREATE UNIQUE INDEX IF NOT EXISTS classes_templates_pkey ON public.classes_templates USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS events_pkey ON public.events USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS exercises_aux_pkey ON public.program_exercises USING btree (id);

CREATE INDEX IF NOT EXISTS idx_classes_templates_company ON public.classes_templates USING btree (company);

CREATE INDEX IF NOT EXISTS idx_events_company ON public.events USING btree (company);

CREATE UNIQUE INDEX IF NOT EXISTS plans_pkey ON public.programs USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_token_unique ON public.profiles USING btree (invite_token) WHERE (invite_token IS NOT NULL);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_templates_pkey') THEN
    ALTER TABLE "public"."classes_templates" ADD CONSTRAINT "classes_templates_pkey" PRIMARY KEY USING INDEX "classes_templates_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_pkey') THEN
    ALTER TABLE "public"."companies" ADD CONSTRAINT "companies_pkey" PRIMARY KEY USING INDEX "companies_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_pkey') THEN
    ALTER TABLE "public"."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY USING INDEX "events_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_pkey') THEN
    ALTER TABLE "public"."program_exercises" ADD CONSTRAINT "exercises_aux_pkey" PRIMARY KEY USING INDEX "exercises_aux_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_pkey') THEN
    ALTER TABLE "public"."programs" ADD CONSTRAINT "plans_pkey" PRIMARY KEY USING INDEX "plans_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anatomy_company_fkey') THEN
    ALTER TABLE "public"."anatomy" ADD CONSTRAINT "anatomy_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anatomy_company_fkey') THEN
    ALTER TABLE "public"."anatomy" VALIDATE CONSTRAINT "anatomy_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_templates_company_fkey') THEN
    ALTER TABLE "public"."classes_templates" ADD CONSTRAINT "classes_templates_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_templates_company_fkey') THEN
    ALTER TABLE "public"."classes_templates" VALIDATE CONSTRAINT "classes_templates_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_templates_company_fkey1') THEN
    ALTER TABLE "public"."classes_templates" ADD CONSTRAINT "classes_templates_company_fkey1" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_templates_company_fkey1') THEN
    ALTER TABLE "public"."classes_templates" VALIDATE CONSTRAINT "classes_templates_company_fkey1";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_company_fkey') THEN
    ALTER TABLE "public"."equipment" ADD CONSTRAINT "equipment_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_company_fkey') THEN
    ALTER TABLE "public"."equipment" VALIDATE CONSTRAINT "equipment_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_company_fkey') THEN
    ALTER TABLE "public"."events" ADD CONSTRAINT "events_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_company_fkey') THEN
    ALTER TABLE "public"."events" VALIDATE CONSTRAINT "events_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_company_fkey') THEN
    ALTER TABLE "public"."exercises" ADD CONSTRAINT "exercises_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_company_fkey') THEN
    ALTER TABLE "public"."exercises" VALIDATE CONSTRAINT "exercises_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_company_fkey') THEN
    ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_company_fkey') THEN
    ALTER TABLE "public"."profiles" VALIDATE CONSTRAINT "profiles_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_invite_expires_valid') THEN
    ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_invite_expires_valid" CHECK (((invite_expires_at IS NULL) OR (invite_expires_at > now()))) NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_invite_expires_valid') THEN
    ALTER TABLE "public"."profiles" VALIDATE CONSTRAINT "profiles_invite_expires_valid";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_fkey') THEN
    ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_user_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_fkey') THEN
    ALTER TABLE "public"."profiles" VALIDATE CONSTRAINT "profiles_user_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_exercise_fkey') THEN
    ALTER TABLE "public"."program_exercises" ADD CONSTRAINT "exercises_aux_exercise_fkey" FOREIGN KEY (exercise) REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_aux_exercise_fkey') THEN
    ALTER TABLE "public"."program_exercises" VALIDATE CONSTRAINT "exercises_aux_exercise_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_company_fkey') THEN
    ALTER TABLE "public"."programs" ADD CONSTRAINT "plans_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_company_fkey') THEN
    ALTER TABLE "public"."programs" VALIDATE CONSTRAINT "plans_company_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_profile_fkey') THEN
    ALTER TABLE "public"."programs" ADD CONSTRAINT "plans_profile_fkey" FOREIGN KEY (profile) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_profile_fkey') THEN
    ALTER TABLE "public"."programs" VALIDATE CONSTRAINT "plans_profile_fkey";
  END IF;
END $$;

alter table "public"."program_exercises" add constraint "program_exercises_program_fkey" FOREIGN KEY (program) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."program_exercises" validate constraint "program_exercises_program_fkey";

set check_function_bodies = off;

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
$function$
;

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

CREATE OR REPLACE FUNCTION public.get_company_by_id(p_company uuid)
 RETURNS SETOF public.companies
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT c.*
  FROM public.companies c
  WHERE c.id = p_company
    AND public.is_member_of_company(c.id)
$function$
;

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
  JOIN public.profiles p ON p."user" = auth.uid()
  WHERE e.company = p.company
  ORDER BY e.datetime ASC;
$function$
;

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
$function$
;

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
          WHERE p.user = auth.uid()
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
    WHERE p.user = auth.uid() AND p.role = 'admin' AND p.company = company_id
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
    WHERE (p.user = auth.uid() OR p.id = auth.uid()) AND p.company = company_id
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

grant delete on table "public"."classes_templates" to "anon";

grant insert on table "public"."classes_templates" to "anon";

grant references on table "public"."classes_templates" to "anon";

grant select on table "public"."classes_templates" to "anon";

grant trigger on table "public"."classes_templates" to "anon";

grant truncate on table "public"."classes_templates" to "anon";

grant update on table "public"."classes_templates" to "anon";

grant delete on table "public"."classes_templates" to "authenticated";

grant insert on table "public"."classes_templates" to "authenticated";

grant references on table "public"."classes_templates" to "authenticated";

grant select on table "public"."classes_templates" to "authenticated";

grant trigger on table "public"."classes_templates" to "authenticated";

grant truncate on table "public"."classes_templates" to "authenticated";

grant update on table "public"."classes_templates" to "authenticated";

grant delete on table "public"."classes_templates" to "service_role";

grant insert on table "public"."classes_templates" to "service_role";

grant references on table "public"."classes_templates" to "service_role";

grant select on table "public"."classes_templates" to "service_role";

grant trigger on table "public"."classes_templates" to "service_role";

grant truncate on table "public"."classes_templates" to "service_role";

grant update on table "public"."classes_templates" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant references on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant trigger on table "public"."events" to "anon";

grant truncate on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant references on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant trigger on table "public"."events" to "authenticated";

grant truncate on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant references on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant trigger on table "public"."events" to "service_role";

grant truncate on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "Company members can delete"
    ON "public"."anatomy"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "Company members can insert"
    ON "public"."anatomy"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((company = ( SELECT p.company
       FROM public.profiles p
      WHERE (p."user" = auth.uid())
     LIMIT 1)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "Company members can select"
    ON "public"."anatomy"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "Company members can update"
    ON "public"."anatomy"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))))
    WITH CHECK ((company = ( SELECT p.company
       FROM public.profiles p
      WHERE (p."user" = auth.uid())
     LIMIT 1)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anatomy_select_company' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "anatomy_select_company"
    ON "public"."anatomy"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.company = anatomy.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anatomy_write_company' AND n.nspname = 'public' AND c.relname = 'anatomy'
  ) THEN
    CREATE POLICY "anatomy_write_company"
    ON "public"."anatomy"
    AS permissive
    FOR all
    TO public
    USING (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = anatomy.company))))))
    WITH CHECK (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'delete_classes_templates_by_professional' AND n.nspname = 'public' AND c.relname = 'classes_templates'
  ) THEN
    CREATE POLICY "delete_classes_templates_by_professional"
    ON "public"."classes_templates"
    AS permissive
    FOR delete
    TO authenticated
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'insert_classes_templates_by_professional' AND n.nspname = 'public' AND c.relname = 'classes_templates'
  ) THEN
    CREATE POLICY "insert_classes_templates_by_professional"
    ON "public"."classes_templates"
    AS permissive
    FOR insert
    TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'select_classes_templates_by_company' AND n.nspname = 'public' AND c.relname = 'classes_templates'
  ) THEN
    CREATE POLICY "select_classes_templates_by_company"
    ON "public"."classes_templates"
    AS permissive
    FOR select
    TO authenticated
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'update_classes_templates_by_professional' AND n.nspname = 'public' AND c.relname = 'classes_templates'
  ) THEN
    CREATE POLICY "update_classes_templates_by_professional"
    ON "public"."classes_templates"
    AS permissive
    FOR update
    TO authenticated
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Select company for members' AND n.nspname = 'public' AND c.relname = 'companies'
  ) THEN
    CREATE POLICY "Select company for members"
    ON "public"."companies"
    AS permissive
    FOR select
    TO public
    USING (public.is_same_company(id));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_select_companies_for_members' AND n.nspname = 'public' AND c.relname = 'companies'
  ) THEN
    CREATE POLICY "allow_select_companies_for_members"
    ON "public"."companies"
    AS permissive
    FOR select
    TO public
    USING (public.is_member_of_company(id));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'companies_select_company_members' AND n.nspname = 'public' AND c.relname = 'companies'
  ) THEN
    CREATE POLICY "companies_select_company_members"
    ON "public"."companies"
    AS permissive
    FOR select
    TO public
    USING (public.is_profile_member_of(id));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'companies_select_member' AND n.nspname = 'public' AND c.relname = 'companies'
  ) THEN
    CREATE POLICY "companies_select_member"
    ON "public"."companies"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.company = companies.id)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'companies_update_professional' AND n.nspname = 'public' AND c.relname = 'companies'
  ) THEN
    CREATE POLICY "companies_update_professional"
    ON "public"."companies"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = companies.id)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "Company members can delete"
    ON "public"."equipment"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "Company members can insert"
    ON "public"."equipment"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((company = ( SELECT p.company
       FROM public.profiles p
      WHERE (p."user" = auth.uid())
     LIMIT 1)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "Company members can select"
    ON "public"."equipment"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "Company members can update"
    ON "public"."equipment"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))))
    WITH CHECK ((company = ( SELECT p.company
       FROM public.profiles p
      WHERE (p."user" = auth.uid())
     LIMIT 1)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'equipment_select_company' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "equipment_select_company"
    ON "public"."equipment"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.company = equipment.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'equipment_write_company' AND n.nspname = 'public' AND c.relname = 'equipment'
  ) THEN
    CREATE POLICY "equipment_write_company"
    ON "public"."equipment"
    AS permissive
    FOR all
    TO public
    USING (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = equipment.company))))))
    WITH CHECK (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Select owner or company' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "Select owner or company"
    ON "public"."events"
    AS permissive
    FOR select
    TO public
    USING (public.is_same_company(company));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Update owner or company' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "Update owner or company"
    ON "public"."events"
    AS permissive
  for update
  to public
using (public.is_same_company(company))
with check (public.is_same_company(company));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_delete_company_members' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_delete_company_members"
    ON "public"."events"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_delete_professional_or_service' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_delete_professional_or_service"
    ON "public"."events"
    AS permissive
    FOR delete
    TO public
    USING (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = events.company))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_insert_professional_or_service' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_insert_professional_or_service"
    ON "public"."events"
    AS permissive
    FOR insert
    TO public
    WITH CHECK (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_insert_professionals' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_insert_professionals"
    ON "public"."events"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = p.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_policy_delete' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_policy_delete"
    ON "public"."events"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_policy_insert' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_policy_insert"
    ON "public"."events"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.role = ANY (ARRAY['professional'::text, 'admin'::text])) AND (p.company = p.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_policy_select' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_policy_select"
    ON "public"."events"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_policy_update' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_policy_update"
    ON "public"."events"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = p.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_select_company_member' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_select_company_member"
    ON "public"."events"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.company = events.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_select_company_members' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_select_company_members"
    ON "public"."events"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_update_company_members' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_update_company_members"
    ON "public"."events"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = p.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'events_update_professional_or_service' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "events_update_professional_or_service"
    ON "public"."events"
    AS permissive
    FOR update
    TO public
    USING (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = events.company))))))
    WITH CHECK (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'select_events_by_company_and_role' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY "select_events_by_company_and_role"
    ON "public"."events"
    AS permissive
    FOR select
    TO authenticated
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = events.company) AND ((p.role = 'professional'::text) OR ((p.role = 'client'::text) AND ((events.type = 'class'::text) OR ((events.type = 'appointment'::text) AND ((p.id = ANY (events.client)) OR (p."user" = ANY (events.client)))))))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'company_resource_select' AND n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN
    CREATE POLICY "company_resource_select"
    ON "public"."exercises"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p.id = auth.uid()) AND (p.company = exercises.company)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'company_resource_write' AND n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN
    CREATE POLICY "company_resource_write"
    ON "public"."exercises"
    AS permissive
    FOR all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = exercises.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Delete own profile' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "Delete own profile"
    ON "public"."profiles"
    AS permissive
    FOR delete
    TO public
    USING (((auth.uid() = "user") OR (auth.uid() = id)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Enable insert for authenticated users only' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users only"
    ON "public"."profiles"
    AS permissive
    FOR insert
    TO authenticated
    WITH CHECK (true);
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Select owner or company' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "Select owner or company"
    ON "public"."profiles"
    AS permissive
    FOR select
    TO public
    USING (((auth.uid() = "user") OR (auth.uid() = id) OR public.is_same_company(company)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Update own profile' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "Update own profile"
    ON "public"."profiles"
    AS permissive
    FOR update
    TO public
    USING (((auth.uid() = "user") OR (auth.uid() = id)))
    WITH CHECK (((auth.uid() = "user") OR (auth.uid() = id)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_delete_professional_same_company_delete' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_delete_professional_same_company_delete"
    ON "public"."profiles"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p2
      WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_policy_delete_admins' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_policy_delete_admins"
    ON "public"."profiles"
    AS permissive
    FOR delete
    TO public
    USING (public.is_profile_admin_of(company));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_policy_select_company_members' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_policy_select_company_members"
    ON "public"."profiles"
    AS permissive
    FOR select
    TO public
    USING ((("user" = auth.uid()) OR public.is_profile_member_of(company)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_policy_update_company_members' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_policy_update_company_members"
    ON "public"."profiles"
    AS permissive
    FOR update
    TO public
    USING ((public.is_profile_member_of(company) OR ("user" = auth.uid())))
    WITH CHECK ((public.is_profile_member_of(company) OR ("user" = auth.uid())));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_update_own' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_update_own"
    ON "public"."profiles"
    AS permissive
    FOR update
    TO public
    USING (((auth.uid())::text = (USER)::text))
    WITH CHECK (((auth.uid())::text = (USER)::text));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'profiles_update_professional_same_company_update' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY "profiles_update_professional_same_company_update"
    ON "public"."profiles"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p2
      WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p2
      WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN
    CREATE POLICY "Company members can delete"
    ON "public"."exercises"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN
    CREATE POLICY "Company members can insert"
    ON "public"."exercises"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'exercises'
  ) THEN
    CREATE POLICY "Company members can update"
    ON "public"."exercises"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can delete' AND n.nspname = 'public' AND c.relname = 'program_exercises'
  ) THEN
    CREATE POLICY "Company members can delete"
    ON "public"."program_exercises"
    AS permissive
    FOR delete
    TO public
    USING ((EXISTS ( SELECT 1
       FROM (public.profiles p
         JOIN public.programs prog ON ((prog.company = p.company)))
      WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'program_exercises'
  ) THEN
    CREATE POLICY "Company members can insert"
    ON "public"."program_exercises"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((EXISTS ( SELECT 1
       FROM (public.profiles p
         JOIN public.programs prog ON ((prog.company = p.company)))
      WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can select' AND n.nspname = 'public' AND c.relname = 'program_exercises'
  ) THEN
    CREATE POLICY "Company members can select"
    ON "public"."program_exercises"
    AS permissive
    FOR select
    TO public
    USING ((EXISTS ( SELECT 1
       FROM (public.profiles p
         JOIN public.programs prog ON ((prog.company = p.company)))
      WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program)))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'program_exercises'
  ) THEN
    CREATE POLICY "Company members can update"
    ON "public"."program_exercises"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM (public.profiles p
         JOIN public.programs prog ON ((prog.company = p.company)))
      WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM (public.profiles p
         JOIN public.programs prog ON ((prog.company = p.company)))
      WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can insert' AND n.nspname = 'public' AND c.relname = 'programs'
  ) THEN
    CREATE POLICY "Company members can insert"
    ON "public"."programs"
    AS permissive
    FOR insert
    TO public
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Company members can update' AND n.nspname = 'public' AND c.relname = 'programs'
  ) THEN
    CREATE POLICY "Company members can update"
    ON "public"."programs"
    AS permissive
    FOR update
    TO public
    USING ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.profiles p
      WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));
  END IF;
END
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_adjust_class_credits') THEN
    CREATE TRIGGER trg_adjust_class_credits AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_program_exercise_notes') THEN
    CREATE TRIGGER trg_set_program_exercise_notes BEFORE INSERT ON public.program_exercises FOR EACH ROW EXECUTE FUNCTION public.fn_set_program_exercise_notes();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_company_logos_delete' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_company_logos_delete"
    ON "storage"."objects"
    AS permissive
    FOR delete
    TO authenticated
    USING (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
       FROM public.profiles
      WHERE (profiles."user" = auth.uid())
     LIMIT 1))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_company_logos_insert' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_company_logos_insert"
    ON "storage"."objects"
    AS permissive
    FOR insert
    TO authenticated
    WITH CHECK (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
       FROM public.profiles
      WHERE (profiles."user" = auth.uid())
     LIMIT 1))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_company_logos_select' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_company_logos_select"
    ON "storage"."objects"
    AS permissive
    FOR select
    TO authenticated
    USING (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
       FROM public.profiles
      WHERE (profiles."user" = auth.uid())
     LIMIT 1))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_company_logos_update' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_company_logos_update"
    ON "storage"."objects"
    AS permissive
    FOR update
    TO authenticated
    USING (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
       FROM public.profiles
      WHERE (profiles."user" = auth.uid())
     LIMIT 1))));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_profile_photos_delete' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_profile_photos_delete"
    ON "storage"."objects"
    AS permissive
    FOR delete
    TO public
    USING (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_profile_photos_insert' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_profile_photos_insert"
    ON "storage"."objects"
    AS permissive
    FOR insert
    TO public
    WITH CHECK (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));
  END IF;
END
$$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'allow_profile_photos_select' AND n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    CREATE POLICY "allow_profile_photos_select"
    ON "storage"."objects"
    AS permissive
    FOR select
    TO public
    USING (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));
  END IF;
END
$$;





-- End schema snapshot


