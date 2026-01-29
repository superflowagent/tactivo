


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_invite"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invite"("p_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created" timestamp without time zone,
    "company" "uuid",
    "photo_path" "text",
    "last_name" "text",
    "dni" "text",
    "phone" "text",
    "birth_date" timestamp without time zone,
    "role" "text",
    "address" "text",
    "occupation" "text",
    "sport" "text",
    "session_credits" numeric,
    "class_credits" numeric,
    "history" "text",
    "diagnosis" "text",
    "notes" "text",
    "allergies" "text",
    "user" "uuid",
    "invite_token" "uuid",
    "invite_expires_at" timestamp without time zone,
    "email" "text",
    CONSTRAINT "profiles_invite_expires_valid" CHECK ((("invite_expires_at" IS NULL) OR ("invite_expires_at" > "now"())))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite"("p_token" "uuid") RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invite"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_debug"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invite_debug"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_http"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
BEGIN
    -- Cast incoming token to uuid and delegate to uuid overload to avoid operator mismatches
    RETURN public.accept_invite(p_token::uuid);
END;
$$;


ALTER FUNCTION "public"."accept_invite_http"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_verbose"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_invite_verbose"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_class_credits_on_events_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
DECLARE
  raw_client text := NULL;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE (p.id = ANY(as_uuid_array(NEW.client)) OR p."user" = ANY(as_uuid_array(NEW.client))) AND p.role = 'client';

    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE (p.id = ANY(v_ids) OR p."user" = ANY(v_ids)) AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    raw_client := COALESCE(OLD.client::text, '<null>');
    SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.profiles p
    WHERE (p.id = ANY(as_uuid_array(OLD.client)) OR p."user" = ANY(as_uuid_array(OLD.client))) AND p.role = 'client';

    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE (p.id = ANY(v_ids) OR p."user" = ANY(v_ids)) AND p.role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    raw_client := COALESCE(NEW.client::text, '<null>');

    -- Transition: non-class -> class (deduct for all NEW clients)
    IF COALESCE(OLD.type,'') <> 'class' AND COALESCE(NEW.type,'') = 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE (p.id = ANY(as_uuid_array(NEW.client)) OR p."user" = ANY(as_uuid_array(NEW.client))) AND p.role = 'client';

      IF array_length(v_ids,1) IS NOT NULL THEN
        UPDATE public.profiles p
        SET class_credits = COALESCE(class_credits, 0) - 1
        WHERE (p.id = ANY(v_ids) OR p.user = ANY(v_ids)) AND p.role = 'client';
      END IF;

    -- Transition: class -> non-class (refund for all OLD clients)
    ELSIF COALESCE(OLD.type,'') = 'class' AND COALESCE(NEW.type,'') <> 'class' THEN
      SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[]) INTO v_ids
      FROM public.profiles p
      WHERE (p.id = ANY(as_uuid_array(OLD.client)) OR p."user" = ANY(as_uuid_array(OLD.client))) AND p.role = 'client';

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
$$;


ALTER FUNCTION "public"."adjust_class_credits_on_events_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."as_uuid_array"("_val" "anyelement") RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."as_uuid_array"("_val" "anyelement") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_auth_user_for_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_auth_user_for_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dbg_accept_invite_sim"("p_token" "uuid", "p_caller" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."dbg_accept_invite_sim"("p_token" "uuid", "p_caller" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_get_caller_info"() RETURNS TABLE("caller_uid" "text", "caller_company" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT auth.uid()::text AS caller_uid,
    (SELECT company FROM public.profiles WHERE user::text = auth.uid()::text LIMIT 1) AS caller_company;
$$;


ALTER FUNCTION "public"."debug_get_caller_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_list_pg_triggers_profiles"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT jsonb_agg(row_to_json(q)) FROM (
    SELECT t.tgname, p.proname as function_name, n.nspname as function_schema, t.tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.profiles'::regclass
  ) q;
$$;


ALTER FUNCTION "public"."debug_list_pg_triggers_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_list_profiles_triggers"() RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT jsonb_agg(row_to_json(t)) FROM information_schema.triggers t WHERE t.event_object_table = 'profiles';
$$;


ALTER FUNCTION "public"."debug_list_profiles_triggers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_event_json"("p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."delete_event_json"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_program_exercise_notes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public, pg_temp'
    AS $$
BEGIN
  -- If notes is empty or NULL, attempt to copy description from exercises table
  IF (NEW.notes IS NULL OR TRIM(NEW.notes) = '') THEN
    NEW.notes := (SELECT description FROM public.exercises WHERE id = NEW.exercise LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_set_program_exercise_notes"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "max_class_assistants" numeric DEFAULT '5'::numeric,
    "class_block_mins" numeric DEFAULT '720'::numeric,
    "class_unenroll_mins" numeric DEFAULT '120'::numeric,
    "logo_path" "text" DEFAULT ''::"text",
    "open_time" time without time zone DEFAULT '07:00:00'::time without time zone,
    "close_time" time without time zone DEFAULT '19:00:00'::time without time zone,
    "default_appointment_duration" numeric DEFAULT '60'::numeric,
    "default_class_duration" numeric DEFAULT '90'::numeric,
    "domain" "text",
    "self_schedule" boolean DEFAULT false NOT NULL,
    "created" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."self_schedule" IS 'Permite que los clientes se auto-programen citas según disponibilidad';



CREATE OR REPLACE FUNCTION "public"."get_company_by_id"("p_company" "uuid") RETURNS SETOF "public"."companies"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT c.*
  FROM public.companies c
  WHERE c.id = p_company
    AND public.is_member_of_company(c.id)
$$;


ALTER FUNCTION "public"."get_company_by_id"("p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_attendee_profiles"("p_event" "uuid") RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT p.id, p."user", p.name, p.last_name, p.photo_path, p.sport, p.class_credits
  FROM public.events e
  JOIN public.profiles p ON (p.id = ANY(e.client) OR p."user" = ANY(e.client))
  WHERE e.id = p_event
    AND p.company = e.company;
$$;


ALTER FUNCTION "public"."get_event_attendee_profiles"("p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_for_company"("p_company" "uuid") RETURNS TABLE("id" "uuid", "company" "uuid", "datetime" "text", "duration" integer, "type" "text", "client" "uuid"[], "professional" "uuid"[], "notes" "text", "cost" numeric, "paid" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_events_for_company"("p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_by_user"("p_user" "uuid") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_profile_by_user"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer, "dni" "text", "phone" "text", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND company = (
      SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1
    );
$$;


ALTER FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[], "p_company" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    );
$$;


ALTER FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[], "p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "last_name" "text", "email" "text", "phone" "text", "photo_path" "text", "role" "text", "company" "uuid", "class_credits" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[], "p_company" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer, "dni" "text", "phone" "text", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE (id = ANY(p_ids) OR "user" = ANY(p_ids))
    AND role = 'professional'
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    );
$$;


ALTER FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[], "p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "last_name" "text", "photo_path" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.photo_path
  FROM public.profiles p
  WHERE p.role = p_role
    AND public.is_member_of_company(p.company);
$$;


ALTER FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text", "p_company" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer, "dni" "text", "phone" "text", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE role = p_role
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    )
  ORDER BY name;
$$;


ALTER FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text", "p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "last_name" "text", "email" "text", "phone" "text", "photo_path" "text", "role" "text", "company" "uuid", "class_credits" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text", "p_company" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "user" "uuid", "name" "text", "last_name" "text", "photo_path" "text", "sport" "text", "class_credits" integer, "dni" "text", "phone" "text", "email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT id, "user", name, last_name, photo_path, sport, class_credits, dni, phone, email
  FROM public.profiles
  WHERE role = p_role
    AND company = COALESCE(
      p_company,
      (SELECT company FROM public.profiles WHERE "user" = auth.uid() LIMIT 1)
    )
  ORDER BY name;
$$;


ALTER FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text", "p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profiles_for_professionals"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "last_name" "text", "email" "text", "phone" "text", "photo_path" "text", "role" "text", "company" "uuid", "class_credits" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT p.id, p.user AS user_id, p.name, p.last_name, p.email, p.phone, p.photo_path, p.role, p.company, p.class_credits
  FROM public.profiles p
  WHERE public.is_member_of_company(p.company)
    AND EXISTS (
      SELECT 1 FROM public.profiles pu
      WHERE pu.user::text = auth.uid()::text
        AND pu.role = 'professional'
        AND pu.company IS NOT DISTINCT FROM p.company
    );
$$;


ALTER FUNCTION "public"."get_profiles_for_professionals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_event_json"("p_payload" "jsonb") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."insert_event_json"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_company"("p_company" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.company::text = p_company::text
  );
$$;


ALTER FUNCTION "public"."is_member_of_company"("p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_professional_of_company"("p_company" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user::text = auth.uid()::text
      AND p.role = 'professional'
      AND p.company::text = p_company::text
  );
$$;


ALTER FUNCTION "public"."is_professional_of_company"("p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_profile_admin_of"("company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user = auth.uid() AND p.role = 'admin' AND p.company = company_id
  );
$$;


ALTER FUNCTION "public"."is_profile_admin_of"("company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_profile_member_of"("company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.user = auth.uid() OR p.id = auth.uid()) AND p.company = company_id
  );
$$;


ALTER FUNCTION "public"."is_profile_member_of"("company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_same_company"("p_company" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public, pg_temp'
    AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.profiles WHERE (id = auth.uid() OR "user" = auth.uid()) AND company = p_company);
END;
$$;


ALTER FUNCTION "public"."is_same_company"("p_company" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Remove the deleted anatomy id from any exercise arrays
  UPDATE public.exercises ex
  SET anatomy = array_remove(ex.anatomy, OLD.id)
  WHERE OLD.id = ANY (ex.anatomy);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() IS 'Removes deleted anatomy ID from exercises.anatomy array when an anatomy row is deleted.';



CREATE OR REPLACE FUNCTION "public"."unlink_deleted_equipment_from_exercises"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Remove the deleted equipment id from any exercise arrays
  UPDATE public.exercises ex
  SET equipment = array_remove(ex.equipment, OLD.id)
  WHERE OLD.id = ANY (ex.equipment);
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."unlink_deleted_equipment_from_exercises"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."unlink_deleted_equipment_from_exercises"() IS 'Removes deleted equipment ID from exercises.equipment array when an equipment row is deleted.';



CREATE OR REPLACE FUNCTION "public"."update_event_json"("p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."update_event_json"("p_payload" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anatomy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created" timestamp without time zone,
    "company" "uuid"
);


ALTER TABLE "public"."anatomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'class'::"text",
    "created" timestamp without time zone,
    "duration" numeric,
    "cost" numeric DEFAULT '0'::numeric,
    "paid" boolean DEFAULT false,
    "notes" "text",
    "company" "uuid",
    "client" "uuid"[] DEFAULT '{}'::"uuid"[],
    "professional" "uuid"[] DEFAULT '{}'::"uuid"[],
    "time" time without time zone,
    "day" numeric
);


ALTER TABLE "public"."classes_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created" timestamp without time zone,
    "company" "uuid"
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text",
    "datetime" timestamp with time zone,
    "created" timestamp without time zone,
    "duration" numeric,
    "cost" numeric,
    "paid" boolean,
    "notes" "text",
    "company" "uuid",
    "client" "uuid"[] DEFAULT '{}'::"uuid"[],
    "professional" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "file" "text",
    "created" timestamp without time zone,
    "description" "text",
    "company" "uuid",
    "anatomy" "uuid"[] DEFAULT '{}'::"uuid"[],
    "equipment" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


COMMENT ON COLUMN "public"."exercises"."anatomy" IS 'Lista de IDs de la tabla anatomy';



COMMENT ON COLUMN "public"."exercises"."equipment" IS 'Lista de IDs de la tabla anatomy';



CREATE TABLE IF NOT EXISTS "public"."program_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notes" "text",
    "exercise" "uuid",
    "reps" numeric,
    "weight" numeric,
    "sets" numeric,
    "secs" numeric,
    "program" "uuid",
    "position" numeric,
    "day" "text"
);


ALTER TABLE "public"."program_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created" timestamp without time zone,
    "company" "uuid",
    "profile" "uuid",
    "description" "text",
    "position" numeric
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anatomy"
    ADD CONSTRAINT "anatomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes_templates"
    ADD CONSTRAINT "classes_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_exercises"
    ADD CONSTRAINT "exercises_aux_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_anatomy_company" ON "public"."anatomy" USING "btree" ("company");



CREATE INDEX "idx_classes_templates_company" ON "public"."classes_templates" USING "btree" ("company");



CREATE INDEX "idx_equipment_company" ON "public"."equipment" USING "btree" ("company");



CREATE INDEX "idx_events_company" ON "public"."events" USING "btree" ("company");



CREATE INDEX "idx_exercises_company" ON "public"."exercises" USING "btree" ("company");



CREATE INDEX "idx_profiles_company" ON "public"."profiles" USING "btree" ("company");



CREATE INDEX "idx_profiles_user" ON "public"."profiles" USING "btree" ("user");



CREATE INDEX "idx_program_exercises_exercise" ON "public"."program_exercises" USING "btree" ("exercise");



CREATE INDEX "idx_program_exercises_program" ON "public"."program_exercises" USING "btree" ("program");



CREATE INDEX "idx_programs_company" ON "public"."programs" USING "btree" ("company");



CREATE INDEX "idx_programs_profile" ON "public"."programs" USING "btree" ("profile");



CREATE UNIQUE INDEX "profiles_invite_token_unique" ON "public"."profiles" USING "btree" ("invite_token") WHERE ("invite_token" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_adjust_class_credits" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."adjust_class_credits_on_events_change"();



CREATE OR REPLACE TRIGGER "trg_create_auth_user_before_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_auth_user_for_profile"();



CREATE OR REPLACE TRIGGER "trg_set_program_exercise_notes" BEFORE INSERT ON "public"."program_exercises" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_program_exercise_notes"();



CREATE OR REPLACE TRIGGER "trg_unlink_anatomy_from_exercises" AFTER DELETE ON "public"."anatomy" FOR EACH ROW EXECUTE FUNCTION "public"."unlink_deleted_anatomy_from_exercises"();



CREATE OR REPLACE TRIGGER "trg_unlink_equipment_from_exercises" AFTER DELETE ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."unlink_deleted_equipment_from_exercises"();



ALTER TABLE ONLY "public"."anatomy"
    ADD CONSTRAINT "anatomy_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes_templates"
    ADD CONSTRAINT "classes_templates_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes_templates"
    ADD CONSTRAINT "classes_templates_company_fkey1" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_exercises"
    ADD CONSTRAINT "exercises_aux_exercise_fkey" FOREIGN KEY ("exercise") REFERENCES "public"."exercises"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "plans_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "plans_profile_fkey" FOREIGN KEY ("profile") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_fkey" FOREIGN KEY ("company") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_fkey" FOREIGN KEY ("user") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_exercises"
    ADD CONSTRAINT "program_exercises_program_fkey" FOREIGN KEY ("program") REFERENCES "public"."programs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."anatomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "combined_companies_SELECT_6a02ca46564a0d356083487254d9f011" ON "public"."companies" FOR SELECT TO "authenticated" USING (("public"."is_same_company"("id") OR "public"."is_member_of_company"("id") OR "public"."is_profile_member_of"("id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "companies"."id"))))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_update_professional" ON "public"."companies" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "companies"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text")))));



ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "merged_anatomy_DELETE_250ac89cac77f4f9ad5063a8ffe5080a" ON "public"."anatomy" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "anatomy"."company")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "anatomy"."company")))))));



CREATE POLICY "merged_anatomy_SELECT_cb83aa672a99b5dbf80149327436b6bc" ON "public"."anatomy" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "anatomy"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "anatomy"."company"))))));



CREATE POLICY "merged_anatomy_UPDATE_22fe7d2551d2920ef65a3ab130e138e5" ON "public"."anatomy" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "anatomy"."company"))))) WITH CHECK (("company" = ( SELECT "p"."company"
   FROM "public"."profiles" "p"
  WHERE ("p"."user" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "merged_classes_templates_DELETE_fa46ff4a2928e432b8eb7c3cb9ba81b" ON "public"."classes_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text")))));



CREATE POLICY "merged_classes_templates_SELECT_777dc359ffb8454f140dc8bcdfd932e" ON "public"."classes_templates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "classes_templates"."company")))));



CREATE POLICY "merged_classes_templates_UPDATE_e10bda47cd1b4bb747e1931c15e886b" ON "public"."classes_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "classes_templates"."company") AND ("p"."role" = 'professional'::"text")))));



CREATE POLICY "merged_equipment_DELETE_2b150643f8a774997669123ca91cb7f7" ON "public"."equipment" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "equipment"."company")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "equipment"."company")))))));



CREATE POLICY "merged_equipment_SELECT_e521d4e2467b1c6f70529692abbae92c" ON "public"."equipment" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "equipment"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "equipment"."company"))))));



CREATE POLICY "merged_equipment_UPDATE_e1cc5c69c7afe40bf7b17fb4a4483d22" ON "public"."equipment" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "equipment"."company"))))) WITH CHECK (("company" = ( SELECT "p"."company"
   FROM "public"."profiles" "p"
  WHERE ("p"."user" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1)));



CREATE POLICY "merged_events_DELETE_e9880a857fe4d83d1dba8ada2ec462f9" ON "public"."events" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "events"."company"))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company"))))));



CREATE POLICY "merged_events_SELECT_2b7d6fc6d0371dd91c29c7ed0b1683fc" ON "public"."events" FOR SELECT TO "authenticated" USING (("public"."is_same_company"("company") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company") AND (("p"."role" = 'professional'::"text") OR (("p"."role" = 'client'::"text") AND (("events"."type" = 'class'::"text") OR (("events"."type" = 'appointment'::"text") AND (("p"."id" = ANY ("events"."client")) OR ("p"."user" = ANY ("events"."client"))))))))))));



CREATE POLICY "merged_events_UPDATE_3e44e3be845427f6206a51400237e35f" ON "public"."events" FOR UPDATE TO "authenticated" USING (("public"."is_same_company"("company") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "events"."company"))))))) WITH CHECK (("public"."is_same_company"("company") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "events"."company")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text")))))));



CREATE POLICY "merged_exercises_DELETE_1095118e32b59510bcd78c2d9fbf38bd" ON "public"."exercises" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "exercises"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'professional'::"text") AND ("p"."company" = "exercises"."company")))))));



CREATE POLICY "merged_exercises_SELECT_568f840876c8195289f101e6f1280ecd" ON "public"."exercises" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "exercises"."company")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "exercises"."company"))))));



CREATE POLICY "merged_exercises_UPDATE_f7f3200f9a2a0df2b1d9e5b98406dac0" ON "public"."exercises" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "exercises"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "exercises"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "merged_profiles_DELETE_2a3125b4487749717954482cde892ef8" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("public"."is_profile_admin_of"("company") OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p2"
  WHERE ((("p2"."user")::"text" = (( SELECT "auth"."uid"() AS "uid"))::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text"))))));



CREATE POLICY "merged_profiles_SELECT_62827ecf7b96db3f69d12e7aa805c7ab" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_same_company"("company") OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR "public"."is_profile_member_of"("company"))));



CREATE POLICY "merged_profiles_UPDATE_80a80dbdadcd41c493466bc215db3dee" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p2"
  WHERE ((("p2"."user")::"text" = (( SELECT "auth"."uid"() AS "uid"))::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id")) OR "public"."is_same_company"("company")) OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id")) OR ("public"."is_profile_member_of"("company") OR (( SELECT "auth"."uid"() AS "uid") = "user")) OR (( SELECT "auth"."uid"() AS "uid") = "user"))) WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p2"
  WHERE ((("p2"."user")::"text" = (( SELECT "auth"."uid"() AS "uid"))::"text") AND ("p2"."role" = 'professional'::"text") AND (("p2"."company")::"text" = ("profiles"."company")::"text")))) OR ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id")) OR "public"."is_same_company"("company")) OR ((( SELECT "auth"."uid"() AS "uid") = "user") OR (( SELECT "auth"."uid"() AS "uid") = "id")) OR ("public"."is_profile_member_of"("company") OR (( SELECT "auth"."uid"() AS "uid") = "user")) OR (( SELECT "auth"."uid"() AS "uid") = "user")));



CREATE POLICY "merged_program_exercises_DELETE_98b7352cac81410eb64e7ad1821ccbc" ON "public"."program_exercises" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."programs" "prog" ON (("prog"."id" = "program_exercises"."program")))
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "prog"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "merged_program_exercises_SELECT_5757c22c66411e9da86eaeb72c38241" ON "public"."program_exercises" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."programs" "prog" ON (("prog"."company" = "p"."company")))
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("prog"."id" = "program_exercises"."program")))));



CREATE POLICY "merged_program_exercises_UPDATE_524585584e9baa1bda77f7a622bab5c" ON "public"."program_exercises" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."programs" "prog" ON (("prog"."company" = "p"."company")))
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("prog"."id" = "program_exercises"."program") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."programs" "prog" ON (("prog"."company" = "p"."company")))
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("prog"."id" = "program_exercises"."program") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "merged_programs_DELETE_98b7352cac81410eb64e7ad1821ccbce" ON "public"."programs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "programs"."company")))));



CREATE POLICY "merged_programs_SELECT_5757c22c66411e9da86eaeb72c38241a" ON "public"."programs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "programs"."company")))));



CREATE POLICY "merged_programs_UPDATE_524585584e9baa1bda77f7a622bab5c1" ON "public"."programs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "programs"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."company" = "programs"."company") AND (("p"."role" = 'professional'::"text") OR ("p"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invite_debug"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite_debug"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_debug"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invite_http"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite_http"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_http"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invite_verbose"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite_verbose"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_verbose"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."adjust_class_credits_on_events_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_class_credits_on_events_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_class_credits_on_events_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."as_uuid_array"("_val" "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."as_uuid_array"("_val" "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."as_uuid_array"("_val" "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_auth_user_for_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_auth_user_for_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_auth_user_for_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dbg_accept_invite_sim"("p_token" "uuid", "p_caller" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dbg_accept_invite_sim"("p_token" "uuid", "p_caller" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dbg_accept_invite_sim"("p_token" "uuid", "p_caller" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_get_caller_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_get_caller_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_get_caller_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_list_pg_triggers_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_list_pg_triggers_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_list_pg_triggers_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_list_profiles_triggers"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_list_profiles_triggers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_list_profiles_triggers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_event_json"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_event_json"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_event_json"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_program_exercise_notes"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_program_exercise_notes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_program_exercise_notes"() TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_company_by_id"("p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_company_by_id"("p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_company_by_id"("p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_attendee_profiles"("p_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_attendee_profiles"("p_event" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_attendee_profiles"("p_event" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_for_company"("p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_for_company"("p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_for_company"("p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profile_by_user"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_by_user"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profile_by_user"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[], "p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[], "p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_clients"("p_ids" "uuid"[], "p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[], "p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[], "p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_ids_for_professionals"("p_ids" "uuid"[], "p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text", "p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text", "p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_clients"("p_role" "text", "p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text", "p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text", "p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_by_role_for_professionals"("p_role" "text", "p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_for_professionals"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_profiles_for_professionals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_for_professionals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_event_json"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_event_json"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_event_json"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_company"("p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_company"("p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_company"("p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_professional_of_company"("p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_professional_of_company"("p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_professional_of_company"("p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_profile_admin_of"("company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_profile_admin_of"("company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_profile_admin_of"("company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_profile_member_of"("company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_profile_member_of"("company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_profile_member_of"("company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_same_company"("p_company" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_same_company"("p_company" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_same_company"("p_company" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() TO "anon";
GRANT ALL ON FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlink_deleted_anatomy_from_exercises"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlink_deleted_equipment_from_exercises"() TO "anon";
GRANT ALL ON FUNCTION "public"."unlink_deleted_equipment_from_exercises"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlink_deleted_equipment_from_exercises"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_json"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_json"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_json"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."anatomy" TO "anon";
GRANT ALL ON TABLE "public"."anatomy" TO "authenticated";
GRANT ALL ON TABLE "public"."anatomy" TO "service_role";



GRANT ALL ON TABLE "public"."classes_templates" TO "anon";
GRANT ALL ON TABLE "public"."classes_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."classes_templates" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."program_exercises" TO "anon";
GRANT ALL ON TABLE "public"."program_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."program_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







