-- Baseline migration generated on 2026-01-22
-- Exact snapshot of local Supabase schema with manual fixes:
--  - DROP TABLE IF EXISTS public.app_settings CASCADE;
--  - ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;
-- Apply this single migration to bring remote schema to the local state.

BEGIN;

-- Ensure any legacy app_settings table is removed (was present in prod before)
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Remove legacy debug/test column from profiles if present
ALTER TABLE public.profiles DROP COLUMN IF EXISTS test_temp;

COMMIT;

-- The rest of the schema is the canonical snapshot (from 20260121222426_remote_schema.sql)

-- START OF SCHEMA SNAPSHOT
-- Baseline migration generated on 2026-01-22
-- Exact snapshot of local Supabase schema (from 20260121222426_remote_schema.sql)
-- Apply this single migration to provision a DB to the current state.

-- Begin schema snapshot
drop extension if exists "pg_net";

drop policy "Company members can delete" on "public"."exercises";

drop policy "Company members can insert" on "public"."exercises";

drop policy "Company members can update" on "public"."exercises";

drop policy "Company members can delete" on "public"."program_exercises";

drop policy "Company members can insert" on "public"."program_exercises";

drop policy "Company members can select" on "public"."program_exercises";

drop policy "Company members can update" on "public"."program_exercises";

drop policy "Company members can insert" on "public"."programs";

drop policy "Company members can update" on "public"."programs";

alter table "public"."program_exercises" drop constraint "program_exercises_exercise_fkey";

alter table "public"."program_exercises" drop constraint "program_exercises_program_fkey";

alter table "public"."program_exercises" drop constraint "program_exercises_pkey";

alter table "public"."programs" drop constraint "programs_pkey";

drop index if exists "public"."program_exercises_pkey";

drop index if exists "public"."programs_pkey";


  create table "public"."classes_templates" (
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


  create table "public"."companies" (
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


  create table "public"."events" (
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

alter table "public"."anatomy" add column "company" uuid;

alter table "public"."anatomy" add column "created" timestamp without time zone;

alter table "public"."anatomy" enable row level security;

alter table "public"."equipment" add column "company" uuid;

alter table "public"."equipment" add column "created" timestamp without time zone;

alter table "public"."equipment" enable row level security;

alter table "public"."exercises" drop column "created_at";

alter table "public"."exercises" add column "created" timestamp without time zone;

alter table "public"."exercises" add column "description" text;

alter table "public"."exercises" add column "file" text;

alter table "public"."exercises" add column "name" text;

alter table "public"."exercises" alter column "anatomy" set default '{}'::uuid[];

alter table "public"."exercises" alter column "equipment" set default '{}'::uuid[];

alter table "public"."profiles" drop column "created_at";

alter table "public"."profiles" add column "address" text;

alter table "public"."profiles" add column "allergies" text;

alter table "public"."profiles" add column "birth_date" timestamp without time zone;

alter table "public"."profiles" add column "class_credits" numeric;

alter table "public"."profiles" add column "created" timestamp without time zone;

alter table "public"."profiles" add column "diagnosis" text;

alter table "public"."profiles" add column "dni" text;

alter table "public"."profiles" add column "email" text;

alter table "public"."profiles" add column "history" text;

alter table "public"."profiles" add column "invite_expires_at" timestamp without time zone;

alter table "public"."profiles" add column "invite_token" uuid;

alter table "public"."profiles" add column "last_name" text;

alter table "public"."profiles" add column "name" text;

alter table "public"."profiles" add column "notes" text;

alter table "public"."profiles" add column "occupation" text;

alter table "public"."profiles" add column "phone" text;

alter table "public"."profiles" add column "photo_path" text;

alter table "public"."profiles" add column "session_credits" numeric;

alter table "public"."profiles" add column "sport" text;

alter table "public"."profiles" enable row level security;

alter table "public"."program_exercises" drop column "company";

alter table "public"."program_exercises" drop column "created_at";

alter table "public"."program_exercises" add column "day" text;

alter table "public"."program_exercises" add column "reps" numeric;

alter table "public"."program_exercises" add column "secs" numeric;

alter table "public"."program_exercises" add column "sets" numeric;

alter table "public"."program_exercises" add column "weight" numeric;

alter table "public"."program_exercises" alter column "exercise" drop not null;

alter table "public"."program_exercises" alter column "position" drop default;

alter table "public"."program_exercises" alter column "position" set data type numeric using "position"::numeric;

alter table "public"."program_exercises" alter column "program" drop not null;

alter table "public"."programs" drop column "created_at";

alter table "public"."programs" add column "created" timestamp without time zone;

alter table "public"."programs" add column "description" text;

alter table "public"."programs" add column "name" text;

alter table "public"."programs" add column "position" numeric;

alter table "public"."programs" add column "profile" uuid;

CREATE INDEX classes_templates_company_idx ON public.classes_templates USING btree (company);

CREATE UNIQUE INDEX classes_templates_pkey ON public.classes_templates USING btree (id);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);

CREATE UNIQUE INDEX exercises_aux_pkey ON public.program_exercises USING btree (id);

CREATE INDEX idx_classes_templates_company ON public.classes_templates USING btree (company);

CREATE INDEX idx_events_company ON public.events USING btree (company);

CREATE UNIQUE INDEX plans_pkey ON public.programs USING btree (id);

CREATE UNIQUE INDEX profiles_invite_token_unique ON public.profiles USING btree (invite_token) WHERE (invite_token IS NOT NULL);

alter table "public"."classes_templates" add constraint "classes_templates_pkey" PRIMARY KEY using index "classes_templates_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";

alter table "public"."program_exercises" add constraint "exercises_aux_pkey" PRIMARY KEY using index "exercises_aux_pkey";

alter table "public"."programs" add constraint "plans_pkey" PRIMARY KEY using index "plans_pkey";

alter table "public"."anatomy" add constraint "anatomy_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."anatomy" validate constraint "anatomy_company_fkey";

alter table "public"."classes_templates" add constraint "classes_templates_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."classes_templates" validate constraint "classes_templates_company_fkey";

alter table "public"."classes_templates" add constraint "classes_templates_company_fkey1" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."classes_templates" validate constraint "classes_templates_company_fkey1";

alter table "public"."equipment" add constraint "equipment_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."equipment" validate constraint "equipment_company_fkey";

alter table "public"."events" add constraint "events_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."events" validate constraint "events_company_fkey";

alter table "public"."exercises" add constraint "exercises_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."exercises" validate constraint "exercises_company_fkey";

alter table "public"."profiles" add constraint "profiles_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_company_fkey";

alter table "public"."profiles" add constraint "profiles_invite_expires_valid" CHECK (((invite_expires_at IS NULL) OR (invite_expires_at > now()))) NOT VALID not valid;

alter table "public"."profiles" validate constraint "profiles_invite_expires_valid";

alter table "public"."profiles" add constraint "profiles_user_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_fkey";

alter table "public"."program_exercises" add constraint "exercises_aux_exercise_fkey" FOREIGN KEY (exercise) REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."program_exercises" validate constraint "exercises_aux_exercise_fkey";

alter table "public"."programs" add constraint "plans_company_fkey" FOREIGN KEY (company) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."programs" validate constraint "plans_company_fkey";

alter table "public"."programs" add constraint "plans_profile_fkey" FOREIGN KEY (profile) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."programs" validate constraint "plans_profile_fkey";

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


  create policy "Company members can delete"
  on "public"."anatomy"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))));



  create policy "Company members can insert"
  on "public"."anatomy"
  as permissive
  for insert
  to public
with check ((company = ( SELECT p.company
   FROM public.profiles p
  WHERE (p."user" = auth.uid())
 LIMIT 1)));



  create policy "Company members can select"
  on "public"."anatomy"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = anatomy.company)))));



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



  create policy "anatomy_select_company"
  on "public"."anatomy"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.company = anatomy.company)))));



  create policy "anatomy_write_company"
  on "public"."anatomy"
  as permissive
  for all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = anatomy.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));



  create policy "delete_classes_templates_by_professional"
  on "public"."classes_templates"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));



  create policy "insert_classes_templates_by_professional"
  on "public"."classes_templates"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));



  create policy "select_classes_templates_by_company"
  on "public"."classes_templates"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company)))));



  create policy "update_classes_templates_by_professional"
  on "public"."classes_templates"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = classes_templates.company) AND (p.role = 'professional'::text)))));



  create policy "Select company for members"
  on "public"."companies"
  as permissive
  for select
  to public
using (public.is_same_company(id));



  create policy "allow_select_companies_for_members"
  on "public"."companies"
  as permissive
  for select
  to public
using (public.is_member_of_company(id));



  create policy "companies_select_company_members"
  on "public"."companies"
  as permissive
  for select
  to public
using (public.is_profile_member_of(id));



  create policy "companies_select_member"
  on "public"."companies"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.company = companies.id)))));



  create policy "companies_update_professional"
  on "public"."companies"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = companies.id)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text)))));



  create policy "Company members can delete"
  on "public"."equipment"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));



  create policy "Company members can insert"
  on "public"."equipment"
  as permissive
  for insert
  to public
with check ((company = ( SELECT p.company
   FROM public.profiles p
  WHERE (p."user" = auth.uid())
 LIMIT 1)));



  create policy "Company members can select"
  on "public"."equipment"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = equipment.company)))));



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



  create policy "equipment_select_company"
  on "public"."equipment"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.company = equipment.company)))));



  create policy "equipment_write_company"
  on "public"."equipment"
  as permissive
  for all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = equipment.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));



  create policy "Select owner or company"
  on "public"."events"
  as permissive
  for select
  to public
using (public.is_same_company(company));



  create policy "Update owner or company"
  on "public"."events"
  as permissive
  for update
  to public
using (public.is_same_company(company))
with check (public.is_same_company(company));



  create policy "events_delete_company_members"
  on "public"."events"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));



  create policy "events_delete_professional_or_service"
  on "public"."events"
  as permissive
  for delete
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = events.company))))));



  create policy "events_insert_professional_or_service"
  on "public"."events"
  as permissive
  for insert
  to public
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));



  create policy "events_insert_professionals"
  on "public"."events"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = p.company)))));



  create policy "events_policy_delete"
  on "public"."events"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));



  create policy "events_policy_insert"
  on "public"."events"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.role = ANY (ARRAY['professional'::text, 'admin'::text])) AND (p.company = p.company)))));



  create policy "events_policy_select"
  on "public"."events"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));



  create policy "events_policy_update"
  on "public"."events"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = p.company)))));



  create policy "events_select_company_member"
  on "public"."events"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.company = events.company)))));



  create policy "events_select_company_members"
  on "public"."events"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))));



  create policy "events_update_company_members"
  on "public"."events"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = p.company)))));



  create policy "events_update_professional_or_service"
  on "public"."events"
  as permissive
  for update
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = events.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));



  create policy "select_events_by_company_and_role"
  on "public"."events"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = events.company) AND ((p.role = 'professional'::text) OR ((p.role = 'client'::text) AND ((events.type = 'class'::text) OR ((events.type = 'appointment'::text) AND ((p.id = ANY (events.client)) OR (p."user" = ANY (events.client)))))))))));



  create policy "company_resource_select"
  on "public"."exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.company = exercises.company)))));



  create policy "company_resource_write"
  on "public"."exercises"
  as permissive
  for all
  to public
using (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text) AND (p.company = exercises.company))))))
with check (((auth.role() = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'professional'::text))))));



  create policy "Delete own profile"
  on "public"."profiles"
  as permissive
  for delete
  to public
using (((auth.uid() = "user") OR (auth.uid() = id)));



  create policy "Enable insert for authenticated users only"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Select owner or company"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((auth.uid() = "user") OR (auth.uid() = id) OR public.is_same_company(company)));



  create policy "Update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using (((auth.uid() = "user") OR (auth.uid() = id)))
with check (((auth.uid() = "user") OR (auth.uid() = id)));



  create policy "profiles_delete_professional_same_company_delete"
  on "public"."profiles"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p2
  WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))));



  create policy "profiles_policy_delete_admins"
  on "public"."profiles"
  as permissive
  for delete
  to public
using (public.is_profile_admin_of(company));



  create policy "profiles_policy_select_company_members"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((("user" = auth.uid()) OR public.is_profile_member_of(company)));



  create policy "profiles_policy_update_company_members"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((public.is_profile_member_of(company) OR ("user" = auth.uid())))
with check ((public.is_profile_member_of(company) OR ("user" = auth.uid())));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to public
using (((auth.uid())::text = (USER)::text))
with check (((auth.uid())::text = (USER)::text));



  create policy "profiles_update_professional_same_company_update"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p2
  WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p2
  WHERE (((p2."user")::text = (auth.uid())::text) AND (p2.role = 'professional'::text) AND ((p2.company)::text = (profiles.company)::text)))));



  create policy "Company members can delete"
  on "public"."exercises"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));



  create policy "Company members can insert"
  on "public"."exercises"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = exercises.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));



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



  create policy "Company members can delete"
  on "public"."program_exercises"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));



  create policy "Company members can insert"
  on "public"."program_exercises"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));



  create policy "Company members can select"
  on "public"."program_exercises"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.programs prog ON ((prog.company = p.company)))
  WHERE ((p."user" = auth.uid()) AND (prog.id = program_exercises.program)))));



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



  create policy "Company members can insert"
  on "public"."programs"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p."user" = auth.uid()) AND (p.company = programs.company) AND ((p.role = 'professional'::text) OR (p.role = 'admin'::text))))));



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


CREATE TRIGGER trg_adjust_class_credits AFTER INSERT OR DELETE OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();

CREATE TRIGGER trg_set_program_exercise_notes BEFORE INSERT ON public.program_exercises FOR EACH ROW EXECUTE FUNCTION public.fn_set_program_exercise_notes();


  create policy "allow_company_logos_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
   FROM public.profiles
  WHERE (profiles."user" = auth.uid())
 LIMIT 1))));



  create policy "allow_company_logos_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
   FROM public.profiles
  WHERE (profiles."user" = auth.uid())
 LIMIT 1))));



  create policy "allow_company_logos_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
   FROM public.profiles
  WHERE (profiles."user" = auth.uid())
 LIMIT 1))));



  create policy "allow_company_logos_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'company_logos'::text) AND ("substring"(name, '^[^/]+'::text) = ( SELECT (profiles.company)::text AS company
   FROM public.profiles
  WHERE (profiles."user" = auth.uid())
 LIMIT 1))));



  create policy "allow_profile_photos_delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));



  create policy "allow_profile_photos_insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));



  create policy "allow_profile_photos_select"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'profile_photos'::text) AND (auth.uid() IS NOT NULL)));





-- End schema snapshot


