-- Migration: make insert_event_json and adjust_class_credits_on_events_change robust against scalar/boolean payloads
-- - Safely parse jsonb payload fields `client` and `professional` when they are arrays or scalars
-- - Provide clear errors for invalid uuid inputs instead of generic cast failures
-- - Make the trigger tolerant to unexpected column types (treat non-uuid values as empty arrays)

-- Replace insert_event_json
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

  RETURN QUERY
    INSERT INTO public.events (type, duration, cost, paid, notes, datetime, client, professional, company)
    VALUES (v_type, v_duration, v_cost, v_paid, v_notes, v_datetime::timestamptz, v_client, v_professional, v_company)
    RETURNING public.events.id AS id;
END;
$function$;

-- Helper: coerce an arbitrary column value to uuid[] safely (top-level function)
CREATE OR REPLACE FUNCTION public.as_uuid_array(_val anyelement)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Replace trigger function: be defensive when reading NEW/OLD.client
CREATE OR REPLACE FUNCTION public.adjust_class_credits_on_events_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.type, '') = 'class' AND NEW.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) - 1
      WHERE id = ANY(as_uuid_array(NEW.client))
        AND role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.type, '') = 'class' AND OLD.client IS NOT NULL THEN
      UPDATE public.profiles
      SET class_credits = COALESCE(class_credits, 0) + 1
      WHERE id = ANY(as_uuid_array(OLD.client))
        AND role = 'client';
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.type, '') = 'class' OR COALESCE(OLD.type, '') = 'class' THEN
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
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) - (
        SELECT COUNT(*) FROM added a WHERE a.id = p.id OR a.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM added) OR p.user IN (SELECT id FROM added))
        AND p.role = 'client';

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
      UPDATE public.profiles p
      SET class_credits = COALESCE(class_credits, 0) + (
        SELECT COUNT(*) FROM removed r WHERE r.id = p.id OR r.id = p.user
      )
      WHERE (p.id IN (SELECT id FROM removed) OR p.user IN (SELECT id FROM removed))
        AND p.role = 'client';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Ensure trigger exists (recreate trigger binding)
DROP TRIGGER IF EXISTS trg_adjust_class_credits ON public.events;
CREATE TRIGGER trg_adjust_class_credits
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.adjust_class_credits_on_events_change();
